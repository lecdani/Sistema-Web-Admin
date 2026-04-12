import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { City, CityStateOption } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.CITIES;
const U = API_CONFIG.ENDPOINTS.UTILITIES;

function toCity(raw: any): City {
  const statePrefix = String(raw.statePrefix ?? raw.StatePrefix ?? '').trim() || undefined;
  const stateFullName = String(raw.stateFullName ?? raw.StateFullName ?? '').trim() || undefined;
  const country = String(raw.country ?? raw.Country ?? '').trim() || undefined;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    statePrefix,
    stateFullName,
    country,
    state: (() => {
      const v = raw.state ?? raw.State;
      if (v == null || String(v).trim() === '') return undefined;
      if (typeof v === 'string') {
        const t = v.trim();
        const n = Number(t);
        if (String(n) === t && Number.isFinite(n)) return n;
        return /^[A-Za-z]{2}([A-Za-z])?$/i.test(t) ? t.toUpperCase() : t;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    })(),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

function toStateOption(raw: any): CityStateOption | null {
  const vRaw =
    raw?.value ??
    raw?.Value ??
    raw?.state ??
    raw?.State ??
    raw?.code ??
    raw?.Code ??
    raw?.enumValue ??
    raw?.EnumValue ??
    raw?.id ??
    raw?.Id;
  if (vRaw == null) return null;
  const strFromRaw = String(vRaw).trim();
  if (strFromRaw === '') return null;

  const asNum = Number(strFromRaw);
  const looksLikeNumericEnum =
    strFromRaw !== '' && Number.isFinite(asNum) && String(asNum) === strFromRaw;

  const value: string | number = looksLikeNumericEnum ? asNum : strFromRaw.toUpperCase();

  const labelFromApi = String(raw?.label ?? raw?.Label ?? '').trim();
  const enumName = String(raw?.name ?? raw?.Name ?? '').trim();
  const desc = String(raw?.description ?? raw?.Description ?? '').trim();
  const explicitCode = String(
    raw?.code ?? raw?.Code ?? raw?.shortName ?? raw?.ShortName ?? raw?.stateCode ?? raw?.StateCode ?? ''
  ).trim();

  const label =
    labelFromApi ||
    desc ||
    String(raw?.displayName ?? raw?.DisplayName ?? '').trim() ||
    String(raw?.fullName ?? raw?.FullName ?? '').trim() ||
    enumName ||
    (typeof value === 'string' ? value : String(value));

  let code = explicitCode || undefined;
  if (!code && typeof value === 'string' && /^[A-Z]{2}$/i.test(value)) {
    code = value.toUpperCase();
  }
  if (!code && /^[A-Za-z]{2,3}$/.test(enumName)) {
    code = enumName.toUpperCase();
  }

  /** Catálogo típico: `{ id, value: "AL", label }` → el `id` es el entero que espera POST `state`. */
  const enumExtra =
    raw?.enumValue ??
    raw?.EnumValue ??
    raw?.numericValue ??
    raw?.NumericValue ??
    raw?.stateEnum ??
    raw?.StateEnum ??
    raw?.ordinal ??
    raw?.Ordinal ??
    raw?.id ??
    raw?.Id;
  let apiEnumValue: number | undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    apiEnumValue = value;
  } else if (enumExtra != null && String(enumExtra).trim() !== '') {
    const n = Number(enumExtra);
    if (Number.isFinite(n)) apiEnumValue = n;
  }

  return apiEnumValue !== undefined ? { value, code, label, apiEnumValue } : { value, code, label };
}

/**
 * Respaldo si falta `id` en el item: mismo orden que nombre de estado (AL=1, AK=2, … como en
 * `GET /utilities/states` típico).
 */
const STATE_US_BY_STATE_NAME_ORDER: readonly string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY',
];

const STATE_US_ENUM_FALLBACK: Record<string, number> = Object.fromEntries(
  STATE_US_BY_STATE_NAME_ORDER.map((c, i) => [c, i + 1])
);

/** Valor de `state` en JSON para crear/actualizar ciudad (número de enum si aplica). */
export function resolveStateForCityPayload(
  formValue: string,
  option?: CityStateOption | null
): string | number {
  const raw = formValue.trim();
  if (raw === '') return raw;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && String(parsed) === raw) return parsed;

  if (option?.apiEnumValue != null && Number.isFinite(option.apiEnumValue)) {
    return option.apiEnumValue;
  }
  if (option && typeof option.value === 'number' && Number.isFinite(option.value)) {
    return option.value;
  }

  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && STATE_US_ENUM_FALLBACK[upper] !== undefined) {
    return STATE_US_ENUM_FALLBACK[upper];
  }

  return upper;
}

function normalizeStateList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.items && Array.isArray(res.items)) return res.items;
  if (res?.value && Array.isArray(res.value)) return res.value;
  if (res?.states && Array.isArray(res.states)) return res.states;
  if (res?.States && Array.isArray(res.States)) return res.States;
  if (res && typeof res === 'object') {
    for (const v of Object.values(res)) {
      if (Array.isArray(v)) return v as any[];
    }
  }
  return [];
}

/** Body para POST/PUT ciudad: `state` como entero del enum (`StateUsEnum`) salvo backend con strings. */
export type CityPayload = {
  name: string;
  state: string | number;
};

function toPayload(data: CityPayload) {
  const name = data.name.trim();
  const s = data.state;
  const payload: Record<string, unknown> = { name, Name: name };
  if (typeof s === 'number' && Number.isFinite(s)) {
    payload.state = s;
    payload.State = s;
  } else {
    const str = String(s).trim();
    const n = Number(str);
    if (str !== '' && Number.isFinite(n) && String(n) === str) {
      payload.state = n;
      payload.State = n;
    } else {
      payload.state = str;
      payload.State = str;
    }
  }
  return payload as any;
}

/** Lista todas las ciudades */
export async function fetchCities(): Promise<City[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toCity);
}

/** Catálogo del enum de estado (`GET /utilities/states`). */
export async function fetchCityStates(): Promise<CityStateOption[]> {
  const res = await apiClient.get<any>(U.STATES);
  const list = normalizeStateList(res);
  return list
    .map(toStateOption)
    .filter((x): x is CityStateOption => x != null)
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
}

/** Obtiene una ciudad por id */
export async function fetchCityById(id: string): Promise<City | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toCity(res) : null;
  } catch {
    return null;
  }
}

/** Obtiene una ciudad por nombre */
export async function fetchCityByName(name: string): Promise<City | null> {
  const endpoint = E.GET_BY_NAME.replace('{name}', encodeURIComponent(name));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toCity(res) : null;
  } catch {
    return null;
  }
}

/** Crea una ciudad */
export async function createCity(data: CityPayload): Promise<City> {
  const res = await apiClient.post<any>(E.CREATE, toPayload(data));

  // Si devuelve un string, asumimos que es el ID (fix para backend)
  if (typeof res === 'string') {
    const fetched = await fetchCityById(res);
    if (fetched) return fetched;

    return {
      id: res,
      name: data.name.trim(),
      state: data.state,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  return toCity(res);
}

/** Actualiza una ciudad */
export async function updateCity(id: string, data: CityPayload): Promise<City> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, Id: id, ...toPayload(data) };
  const res = await apiClient.put<any>(endpoint, payload);

  if (typeof res === 'string') {
    const fetched = await fetchCityById(id);
    if (fetched) return fetched;

    return {
      id,
      name: data.name.trim(),
      state: data.state,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  return toCity(res);
}

export const citiesApi = {
  fetchAll: fetchCities,
  fetchStates: fetchCityStates,
  getById: fetchCityById,
  getByName: fetchCityByName,
  create: createCity,
  update: updateCity
};
