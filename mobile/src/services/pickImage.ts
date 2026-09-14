import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type PickImageOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

/**
 * Ouvre le photo picker systeme.
 * Sur Android 13+, on n'a PAS besoin de READ_MEDIA_IMAGES :
 * le system picker suffit (politique Google Play).
 * Sur iOS, on demande toujours l'acces photos.
 */
export async function pickImageFromLibrary(
  options: PickImageOptions = {},
): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission', "Autorisez l'acces a la galerie");
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: options.quality ?? 0.7,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}
