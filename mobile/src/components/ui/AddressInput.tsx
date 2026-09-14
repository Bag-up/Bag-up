import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { searchLocations, SenegalLocation } from '../../constants/senegalLocations';
import { api } from '../../services/api';
import { getCurrentAddress, GeoAddress, parseLatLng, reverseGeocode } from '../../services/location';
import {
  autocompletePlaces,
  createPlacesSessionToken,
  getPlaceDetails,
  isPlacesConfigured,
} from '../../services/places';

type Suggestion = {
  id: string;
  label: string;
  subtitle: string;
  source: 'local' | 'places' | 'coords';
  lat?: number;
  lng?: number;
  city?: string;
  country?: string;
  placeId?: string;
};

/** Ferme le menu d’une autre AddressInput quand on focus celle-ci. */
let closeActiveAddressMenu: (() => void) | null = null;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (location: SenegalLocation) => void;
  onGeoSelect?: (addr: GeoAddress) => void;
  onFocus?: () => void;
  onDropdownInteract?: (active: boolean) => void;
  onMenuChange?: (open: boolean) => void;
  placeholder: string;
  iconColor?: string;
  icon?: string;
  showLocBtn?: boolean;
  placesCountry?: string | null;
}

export const AddressInput: React.FC<Props> = ({
  value,
  onChangeText,
  onSelect,
  onGeoSelect,
  onFocus,
  onDropdownInteract,
  onMenuChange,
  placeholder,
  iconColor = Colors.primary,
  icon = 'navigate-circle-outline',
  showLocBtn = false,
  placesCountry = 'sn',
}) => {
  const { token } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [resolvingCoords, setResolvingCoords] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const selectingRef = useRef(false);
  /** Après une sélection réussie : pas de réouverture auto du menu / clavier. */
  const justSelectedRef = useRef(false);
  const onDropdownInteractRef = useRef(onDropdownInteract);
  const onMenuChangeRef = useRef(onMenuChange);
  onDropdownInteractRef.current = onDropdownInteract;
  onMenuChangeRef.current = onMenuChange;

  const setMenu = (open: boolean) => {
    setMenuOpen(open);
    onMenuChangeRef.current?.(open);
    onDropdownInteractRef.current?.(open);
  };

  const cancelPending = () => {
    requestIdRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (coordsTimerRef.current) {
      clearTimeout(coordsTimerRef.current);
      coordsTimerRef.current = null;
    }
    setPlacesLoading(false);
    setResolvingCoords(false);
  };

  const closeMenu = () => {
    setMenu(false);
    setSuggestions([]);
    setSearchDone(false);
    setPlacesLoading(false);
    setResolvingCoords(false);
  };

  useEffect(() => {
    return () => {
      cancelPending();
      onDropdownInteractRef.current?.(false);
      onMenuChangeRef.current?.(false);
      if (closeActiveAddressMenu === closeMenu) closeActiveAddressMenu = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitSelection = (loc: SenegalLocation) => {
    onSelect(loc);
    onGeoSelect?.({
      label: loc.label,
      city: loc.city,
      country: loc.country,
      lat: loc.lat,
      lng: loc.lng,
    });
  };

  const commitSelection = (loc: SenegalLocation) => {
    selectingRef.current = true;
    justSelectedRef.current = true;
    cancelPending();
    // Met à jour le texte contrôlé, puis les coords via onSelect/onGeoSelect.
    onChangeText(loc.label);
    emitSelection(loc);
    closeMenu();
    setFocused(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => {
      selectingRef.current = false;
    }, 400);
  };

  const localHits = (text: string): Suggestion[] =>
    searchLocations(text)
      .slice(0, 12)
      .map((loc, idx) => ({
        id: `local-${idx}-${loc.label}`,
        label: loc.label,
        subtitle: `${loc.city}, ${loc.country}`,
        source: 'local' as const,
        lat: loc.lat,
        lng: loc.lng,
        city: loc.city,
        country: loc.country,
      }));

  const mergeSuggestions = (places: Suggestion[], local: Suggestion[]): Suggestion[] => {
    if (places.length === 0) return local;
    const covered = places.map((p) => `${p.label} ${p.subtitle}`.toLowerCase());
    const extras = local.filter((item) => {
      const name = item.label.toLowerCase();
      const short = name.split(',')[0]?.trim() || name;
      return !covered.some(
        (label) => label.includes(short) || short.includes(label.split(',')[0]?.trim() || label),
      );
    });
    return [...local.slice(0, 4), ...places, ...extras.slice(0, 2)]
      .filter((item, idx, arr) => arr.findIndex((x) => x.label.toLowerCase() === item.label.toLowerCase()) === idx)
      .slice(0, 12);
  };

  const runPlacesSearch = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setPlacesLoading(false);
      setSearchDone(true);
      return;
    }

    const reqId = ++requestIdRef.current;
    const local = localHits(trimmed);
    // Afficher tout de suite le local ; ne pas vider si déjà présent.
    if (local.length > 0) {
      setSuggestions(local);
      setSearchDone(true);
    } else {
      setPlacesLoading(true);
      setSearchDone(false);
    }

    debounceRef.current = setTimeout(async () => {
      let placeSuggestions: Suggestion[] = [];
      try {
        if (token) {
          const remote = await api.geo
            .places(trimmed, token, sessionTokenRef.current, placesCountry || 'sn')
            .catch(() => []);
          placeSuggestions = (Array.isArray(remote) ? remote : []).map((p: any) => ({
            id: `places-${p.placeId}`,
            label: p.label,
            subtitle: p.subtitle || '',
            source: 'places' as const,
            placeId: p.placeId,
          }));
        }
        if (placeSuggestions.length === 0 && isPlacesConfigured()) {
          const direct = await autocompletePlaces(trimmed, sessionTokenRef.current, {
            country: placesCountry,
          });
          placeSuggestions = direct.map((p) => ({
            id: `places-${p.placeId}`,
            label: p.label,
            subtitle: p.subtitle,
            source: 'places' as const,
            placeId: p.placeId,
          }));
        }
      } catch {
        placeSuggestions = [];
      }
      // Sélection / nouvelle frappe entre-temps → ignorer
      if (reqId !== requestIdRef.current || justSelectedRef.current) return;
      const nextLocal = localHits(trimmed);
      const merged = mergeSuggestions(placeSuggestions, nextLocal);
      setSuggestions(merged);
      setPlacesLoading(false);
      setSearchDone(true);
    }, 280);
  };

  const tryResolveCoordinates = async (text: string) => {
    const parsed = parseLatLng(text);
    if (!parsed) return;
    const reqId = ++requestIdRef.current;
    setResolvingCoords(true);
    setMenu(true);
    setSuggestions([
      {
        id: `coords-${parsed.lat},${parsed.lng}`,
        label: 'Résolution de la position…',
        subtitle: `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`,
        source: 'coords',
        lat: parsed.lat,
        lng: parsed.lng,
      },
    ]);
    setSearchDone(false);
    try {
      const addr = await reverseGeocode(parsed.lat, parsed.lng);
      if (reqId !== requestIdRef.current || justSelectedRef.current) return;
      commitSelection({
        label: addr?.label || `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`,
        city: addr?.city || '',
        country: addr?.country || 'Sénégal',
        lat: parsed.lat,
        lng: parsed.lng,
      });
    } finally {
      if (reqId === requestIdRef.current) setResolvingCoords(false);
    }
  };

  const handleChange = (text: string) => {
    justSelectedRef.current = false;
    onChangeText(text);
    cancelPending();

    if (!text.trim()) {
      closeMenu();
      return;
    }

    setMenu(true);
    const local = localHits(text);
    setSuggestions(local);
    setSearchDone(local.length > 0);
    setPlacesLoading(false);

    if (parseLatLng(text)) {
      coordsTimerRef.current = setTimeout(() => {
        void tryResolveCoordinates(text);
      }, 180);
      return;
    }

    runPlacesSearch(text);
  };

  const handleSelectLocal = (item: Suggestion) => {
    if (item.lat == null || item.lng == null) return;
    commitSelection({
      label: item.label,
      city: item.city || '',
      country: item.country || 'Sénégal',
      lat: item.lat,
      lng: item.lng,
    });
  };

  const handleSelectPlace = async (item: Suggestion) => {
    if (!item.placeId || selectingRef.current) return;
    selectingRef.current = true;
    justSelectedRef.current = true;
    cancelPending();
    setPlacesLoading(true);
    try {
      const remote = token
        ? await api.geo.placeDetails(item.placeId, token, sessionTokenRef.current).catch(() => null)
        : null;
      const details = remote?.lat
        ? {
            label: remote.address || remote.label || item.label,
            city: remote.city || 'Dakar',
            country: remote.country || 'Sénégal',
            lat: remote.lat as number,
            lng: remote.lng as number,
          }
        : await getPlaceDetails(item.placeId, sessionTokenRef.current);
      sessionTokenRef.current = createPlacesSessionToken();

      if (!details?.lat) {
        // Fallback : garder le libellé Google même sans coords précises
        justSelectedRef.current = false;
        selectingRef.current = false;
        setPlacesLoading(false);
        onChangeText(item.label);
        setSuggestions((prev) => prev.filter((s) => s.id !== item.id));
        return;
      }

      commitSelection({
        label: details.label,
        city: details.city,
        country: details.country,
        lat: details.lat,
        lng: details.lng,
      });
    } catch {
      justSelectedRef.current = false;
      selectingRef.current = false;
      setPlacesLoading(false);
    }
  };

  const handleBlur = () => {
    if (selectingRef.current || justSelectedRef.current) {
      setFocused(false);
      return;
    }
    setFocused(false);
  };

  const handleFocus = () => {
    if (closeActiveAddressMenu && closeActiveAddressMenu !== closeMenu) {
      closeActiveAddressMenu();
    }
    closeActiveAddressMenu = closeMenu;
    setFocused(true);
    onFocus?.();

    // Ignore le focus parasite juste après une sélection (clavier qui se rouvre).
    if (selectingRef.current) return;

    justSelectedRef.current = false;

    if (value.trim().length > 0) {
      setMenu(true);
      const local = localHits(value);
      setSuggestions(local);
      setSearchDone(local.length > 0);
      if (!parseLatLng(value)) runPlacesSearch(value);
    }
  };

  const handleLocate = async () => {
    setLocating(true);
    try {
      const addr = await getCurrentAddress();
      if (addr) {
        commitSelection({
          label: addr.label,
          city: addr.city,
          country: addr.country,
          lat: addr.lat,
          lng: addr.lng,
        });
      }
    } catch (e: any) {
      Keyboard.dismiss();
      Alert.alert('Localisation', e.message || "Impossible d'obtenir votre position");
    } finally {
      setLocating(false);
    }
  };

  const showDropdown = menuOpen && value.trim().length > 0;
  const showLoading = (placesLoading || resolvingCoords) && suggestions.length === 0;
  const showEmpty = searchDone && !placesLoading && !resolvingCoords && suggestions.length === 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <Ionicons name={icon as any} size={20} color={iconColor} style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={Colors.gray400}
          blurOnSubmit
          returnKeyType="done"
          onSubmitEditing={() => {
            if (suggestions.length === 1 && suggestions[0].source !== 'coords') {
              const only = suggestions[0];
              if (only.source === 'places') void handleSelectPlace(only);
              else handleSelectLocal(only);
              return;
            }
            Keyboard.dismiss();
          }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {(placesLoading || locating || resolvingCoords) && (
          <ActivityIndicator size="small" color={iconColor} style={styles.loadingInline} />
        )}
        {showLocBtn && (
          <Pressable
            onPress={handleLocate}
            style={styles.locBtn}
            disabled={locating || resolvingCoords}
            hitSlop={8}
          >
            {locating || resolvingCoords ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <Ionicons name="locate" size={18} color={iconColor} />
            )}
          </Pressable>
        )}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {showLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>
                {resolvingCoords ? 'Détection de la position…' : "Recherche d'adresses…"}
              </Text>
            </View>
          ) : showEmpty ? (
            <View style={styles.loadingRow}>
              <Ionicons name="search-outline" size={16} color={Colors.gray400} />
              <Text style={styles.loadingText}>Aucun lieu trouvé. Affinez le nom.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.dropdownList}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              nestedScrollEnabled
              bounces={false}
              showsVerticalScrollIndicator
            >
              {suggestions.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.suggestionItem, pressed && styles.suggestionPressed]}
                  disabled={item.source === 'coords' || selectingRef.current}
                  onPress={() => {
                    if (item.source === 'coords') return;
                    if (item.source === 'places') void handleSelectPlace(item);
                    else handleSelectLocal(item);
                  }}
                >
                  <Ionicons
                    name={
                      item.source === 'places'
                        ? 'globe-outline'
                        : item.source === 'coords'
                          ? 'navigate-outline'
                          : 'location-outline'
                    }
                    size={16}
                    color={Colors.gray400}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionLabel} numberOfLines={2}>
                      {item.label}
                    </Text>
                    <Text style={styles.suggestionCity} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>
                  {item.source !== 'coords' ? (
                    <Ionicons name="chevron-forward" size={14} color={Colors.gray300} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { zIndex: 20, elevation: 20 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    minHeight: 48,
  },
  inputBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  inputIcon: { marginLeft: Spacing.md },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.gray900,
    minHeight: 48,
  },
  loadingInline: { marginRight: Spacing.xs },
  locBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  dropdown: {
    marginTop: 6,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 12,
    ...Shadows.md,
  },
  dropdownList: { maxHeight: 280 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.base },
  loadingText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  suggestionPressed: { backgroundColor: Colors.primarySoft },
  suggestionLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  suggestionCity: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 1,
  },
});
