import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (auth.isAuthenticated()) {
    return true;
  }

  toast.info('Please sign in to access your account.');
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (auth.isAuthenticated() && auth.isAdmin()) {
    return true;
  }

  toast.error('Administrator credentials required.');
  return router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: state.url },
  });
};
