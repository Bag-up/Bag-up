import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) throw new UnauthorizedException('Token invalide ou manquant');
    return user;
  }
}

/** Auth optionnelle : OTP après inscription, sans bloquer si le token manque. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      /* pas de token ou token invalide */
    }
    return true;
  }

  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}
