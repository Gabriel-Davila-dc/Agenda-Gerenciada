import { HttpInterceptorFn } from '@angular/common/http';

// anexa o token salvo no login em toda requisição, sem precisar repetir o header em cada service
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
