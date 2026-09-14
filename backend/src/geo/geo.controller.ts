import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GeoService } from './geo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('distance')
  distance(
    @Query('lat1') lat1: string,
    @Query('lng1') lng1: string,
    @Query('lat2') lat2: string,
    @Query('lng2') lng2: string,
  ) {
    const km = this.geo.haversineDistance(
      { lat: parseFloat(lat1), lng: parseFloat(lng1) },
      { lat: parseFloat(lat2), lng: parseFloat(lng2) },
    );
    return { distanceKm: km };
  }

  @Get('estimate')
  async estimate(
    @Query('lat1') lat1: string,
    @Query('lng1') lng1: string,
    @Query('lat2') lat2: string,
    @Query('lng2') lng2: string,
    @Query('urgency') urgency: string = 'standard',
    @Query('vehicleMode') vehicleMode?: string,
  ) {
    const route = await this.geo.routeDistance(
      { lat: parseFloat(lat1), lng: parseFloat(lng1) },
      { lat: parseFloat(lat2), lng: parseFloat(lng2) },
    );
    const price = await this.geo.estimatePrice(route.distanceKm, urgency, vehicleMode);
    const vehicleTariff = this.geo.vehicleTariff(vehicleMode);
    return {
      distanceKm: route.distanceKm,
      price,
      durationMin:
        route.source === 'route'
          ? route.durationMin
          : this.geo.estimateDuration(route.distanceKm, urgency),
      deliveryWindow: this.geo.deliveryWindow(urgency),
      vehicleMode: vehicleMode === 'voiture' || vehicleMode === 'moto' ? vehicleMode : null,
      distanceSource: route.source,
      tariff: vehicleTariff,
      indicative: true,
    };
  }

  /** Estimation Course personnes (grille ride dédiée). */
  @Get('estimate-ride')
  async estimateRide(
    @Query('lat1') lat1: string,
    @Query('lng1') lng1: string,
    @Query('lat2') lat2: string,
    @Query('lng2') lng2: string,
    @Query('vehicleMode') vehicleMode: string = 'moto',
  ) {
    const mode = vehicleMode === 'voiture' ? 'voiture' : 'moto';
    const route = await this.geo.routeDistance(
      { lat: parseFloat(lat1), lng: parseFloat(lng1) },
      { lat: parseFloat(lat2), lng: parseFloat(lng2) },
    );
    const price = this.geo.estimateRidePrice(route.distanceKm, mode);
    return {
      distanceKm: route.distanceKm,
      price,
      durationMin:
        route.source === 'route'
          ? route.durationMin
          : this.geo.estimateRideDuration(route.distanceKm),
      vehicleMode: mode,
      distanceSource: route.source,
      tariff: this.geo.rideTariff(mode),
      kind: 'ride',
      indicative: true,
    };
  }

  /** Recherche d’adresses type carte (rues, lieux, villes). */
  @Get('places')
  places(
    @Query('q') q: string,
    @Query('country') country?: string,
    @Query('session') session?: string,
  ) {
    return this.geo.autocompletePlaces(q || '', country || 'sn', session);
  }

  @Get('places/details')
  placeDetails(@Query('placeId') placeId: string, @Query('session') session?: string) {
    return this.geo.placeDetails(placeId, session);
  }
}
