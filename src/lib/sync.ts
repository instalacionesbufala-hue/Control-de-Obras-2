// Quién manda al iniciar sesión: lo que hay en este dispositivo o lo que hay en la nube.
//
// El fallo que corrige: antes se comparaban las fechas de "última modificación" de los dos lados.
// Pero abrir la app ya modifica el estado local (marca la cuenta de Google como vinculada), así
// que el dispositivo que se abría SIEMPRE tenía la fecha más reciente, ganaba, y subía a la nube
// un estado viejo que no había recibido los cambios del otro equipo (por ejemplo, la clave de
// Gemini que acababas de guardar en el ordenador desaparecía al abrir el móvil).
//
// Ahora cada dispositivo recuerda qué versión de la nube fue la última que aplicó o subió (la
// "marca", guardada aparte del estado para que anotarla no cuente como cambio). Con eso se sabe de verdad si la nube ha cambiado por otro lado y si aquí
// hay cambios sin subir, y solo se pregunta al usuario cuando hay trabajo nuevo en los dos sitios.
import { AppState } from '../types';
import { tieneDatosPropios } from './storage';

export type DecisionSync = 'nube' | 'local' | 'preguntar';

export function decidirOrigen(local: AppState | null, remoto: AppState | null, uid: string, marca: string): DecisionSync {
  if (!remoto) return 'local'; // primera vez con esta cuenta: lo de aquí pasa a ser el origen

  const yaVinculado = !!local?.syncUid && local.syncUid === uid;
  if (yaVinculado && local) {
    // Sin marca (estado guardado por una versión anterior de la app): la nube manda. Es lo seguro,
    // porque la nube contiene lo último que se subió desde cualquier equipo.
    if (!marca) return 'nube';
    const nubeCambio = remoto.updatedAt !== marca;
    const localCambio = (local.updatedAt || '') > marca;
    if (!nubeCambio) return 'local'; // la nube no se ha movido desde la última vez: lo de aquí vale
    if (!localCambio) return 'nube'; // aquí no se tocó nada: se trae lo nuevo sin preguntar
    return 'preguntar'; // trabajo nuevo en los dos lados: decide el usuario
  }

  const nubeConDatos = tieneDatosPropios(remoto);
  const localConDatos = tieneDatosPropios(local);
  if (nubeConDatos && !localConDatos) return 'nube'; // dispositivo nuevo, aún con los ejemplos
  if (nubeConDatos && localConDatos) return 'preguntar';
  return 'local';
}

// ¿Hay cambios en este dispositivo que la nube no tiene?
export function hayCambiosSinSubir(local: AppState | null, marca: string): boolean {
  if (!local) return false;
  return (local.updatedAt || '') > (marca || '');
}
