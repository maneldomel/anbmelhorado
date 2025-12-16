export const preserveUrlParams = (location: any): string => {
  // Não preserva mais parâmetros de tracking (UTM etc.).
  // Mantemos apenas parâmetros específicos que o app realmente precisa.
  const allowedKeys: string[] = ['cpf'];
  const searchParams = new URLSearchParams(location.search || '');
  const filtered = new URLSearchParams();

  allowedKeys.forEach((key) => {
    const value = searchParams.get(key);
    if (value) filtered.set(key, value);
  });

  return filtered.toString();
};

export const getUrlParamsString = (location: any, additionalParams?: Record<string, string>): string => {
  const params = preserveUrlParams(location);
  const urlParams = new URLSearchParams(params);

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      urlParams.set(key, value);
    });
  }

  return urlParams.toString();
};

export const navigateWithParams = (
  navigate: any,
  path: string,
  location: any,
  state?: any
): void => {
  const urlParams = preserveUrlParams(location);
  const finalState = {
    ...state,
    urlParams
  };

  navigate(`${path}${urlParams ? `?${urlParams}` : ''}`, { state: finalState });
};

// UTM and tracking helpers removed to keep the application free of external tracking.
