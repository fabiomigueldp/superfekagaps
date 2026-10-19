import routes from './hypotheticalChaseRoutes.json';

/** Complete native-input routes, including the elevated escape from the first high volley. */
export function hypotheticalChaseInputs(route: 'upper' | 'lower'): [number, string[]][] {
    return routes.runs[route] as [number,string[]][];
}
