export interface ItemNav {
  readonly ruta: string;
  readonly icono: string;
  readonly etiqueta: string;
}

/** Cada fase agrega aquí su pantalla (Facturar, Comprobantes...). */
export const ITEMS_NAVEGACION: readonly ItemNav[] = [{ ruta: '/inicio', icono: 'home', etiqueta: 'Inicio' }];

export function estaActivo(item: ItemNav, url: string): boolean {
  const ruta = url.split('?')[0] ?? url;
  return ruta === item.ruta || ruta.startsWith(item.ruta + '/');
}
