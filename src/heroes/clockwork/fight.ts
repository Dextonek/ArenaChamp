import { homingDroneModule } from './spells/homingDrone';
import { deployTurretModule } from './spells/deployTurret';
import { grappleHookModule } from './spells/grappleHook';
import { siegeModeModule } from './spells/siegeMode';

/** What a fight needs of Ada beyond the card: the four spells (they bring the look parts with them). */
export const spells = [homingDroneModule, deployTurretModule, grappleHookModule, siegeModeModule];
