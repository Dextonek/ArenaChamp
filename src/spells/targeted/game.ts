import type { EffectModule } from '../../effects/types';
import { tagOutModule } from './tagOut';
import { pomBackflipModule } from './pomBackflip';
import { pomSnareModule } from './pomSnare';
import { pomPebbleModule } from './pomPebble';
import { pimShieldUpModule } from './pimShieldUp';
import { pimChargeModule } from './pimCharge';
import { pimBonkModule } from './pimBonk';
import { grandLobbyModule } from './grandLobby';
import { doorSlamModule } from './doorSlam';
import { wickDoorModule } from './wickDoor';
import { keyTossModule } from './keyToss';
import { grandFinaleModule } from './grandFinale';
import { hatTrickModule } from './hatTrick';
import { sawnInHalfModule } from './sawnInHalf';
import { cardSprayModule } from './cardSpray';
import { stampedeModule } from './stampede';
import { shearModule } from './shear';
import { spareSheepModule } from './spareSheep';
import { crookWhackModule } from './crookWhack';
import { severeWarningModule } from './severeWarning';
import { forecastUpdateModule } from './forecastUpdate';
import { lightningRiskModule } from './lightningRisk';
import { coldFrontModule } from './coldFront';
import { mrBiscuitModule } from './mrBiscuit';
import { sweaterModule } from './sweater';
import { castOnModule } from './castOn';
import { knittingNeedleModule } from './knittingNeedle';
import { sinkholeModule } from './sinkhole';
import { moleTunnelModule } from './moleTunnel';
import { moleDigModule } from './moleDig';
import { moleClawModule } from './moleClaw';
import { floodModule } from './flood';
import { mopBucketModule } from './mopBucket';
import { wetFloorSignModule } from './wetFloorSign';
import { bigMopModule } from './bigMop';
import { finalDeliveryModule } from './finalDelivery';
import { shortcutModule } from './shortcut';
import { fragileModule } from './fragile';
import { expressLetterModule } from './expressLetter';
import { dinnerIsServedModule } from './dinnerIsServed';
import { burntOfferingModule } from './burntOffering';
import { hotSoupModule } from './hotSoup';
import { thrownCleaverModule } from './thrownCleaver';
import { showTheCardModule } from './showTheCard';
import { noCastingModule } from './noCasting';
import { noRunningModule } from './noRunning';
import { whistleBlastModule } from './whistleBlast';
import { theBoxModule } from './theBox';
import { ropeTrickModule } from './ropeTrick';
import { mimeWallModule } from './mimeWall';
import { invisibleBallModule } from './invisibleBall';
import { saltThrowModule } from './saltThrow';
import { sumoChargeModule } from './sumoCharge';
import { stompModule } from './stomp';
import { palmStrikeModule } from './palmStrike';
import { foreclosureModule } from './foreclosure';
import { callItInModule } from './callItIn';
import { lateFeeModule } from './lateFee';
import { invoiceModule } from './invoice';
import { landOnMyFeetModule } from './landOnMyFeet';
import { pounceModule } from './pounce';
import { knockItOverModule } from './knockItOver';
import { scratchModule } from './scratch';
import { popPinModule } from './popPin';
import { hotAirModule } from './hotAir';
import { heliumBombModule } from './heliumBomb';
import { airHoseModule } from './airHose';
import { timberCallModule } from './timberCall';
import { caberTossModule } from './caberToss';
import { fastGrowthModule } from './fastGrowth';
import { axeSwingModule } from './axeSwing';
import { geraldNoModule } from './geraldNo';
import { aGoodLeanModule } from './aGoodLean';
import { theShoveModule } from './theShove';
import { raiseGeraldModule } from './raiseGerald';
import { hallOfMirrorsModule } from './hallOfMirrors';
import { throughTheGlassModule } from './throughTheGlass';
import { vanityStandModule } from './vanityStand';
import { handMirrorModule } from './handMirror';
import { ricochetLightModule } from './ricochetLight';
import { crystalPillarModule } from './crystalPillar';
import { blindingFlareModule } from './blindingFlare';
import { shatterlightModule } from './shatterlight';
import { inkLashModule } from './inkLash';
import { sealOfBindingModule } from './sealOfBinding';
import { flowingScriptModule } from './flowingScript';
import { theLastCharacterModule } from './theLastCharacter';
import { gravitySlamModule } from './gravitySlam';
import { nullZoneModule } from './nullZone';
import { phaseStepModule } from './phaseStep';
import { blackHoleModule } from './blackHole';
import { homingDroneModule } from './homingDrone';
import { deployTurretModule } from './deployTurret';
import { grappleHookModule } from './grappleHook';
import { siegeModeModule } from './siegeMode';
import { firstLightModule } from './firstLight';
import { dawnwardModule } from './dawnward';
import { oathbrandModule } from './oathbrand';
import { sunriseModule } from './sunrise';
import { barbedStingerModule } from './barbedStinger';
import { hiveShellModule } from './hiveShell';
import { swarmCloudModule } from './swarmCloud';
import { swarmSurgeModule } from './swarmSurge';
import { skyStrikeModule } from './skyStrike';
import { thunderRodModule } from './thunderRod';
import { polarityModule } from './polarity';
import { supercellStormModule } from './supercellStorm';
import { icicleModule } from './icicle';
import { hoarfrostModule } from './hoarfrost';
import { rimeArmourModule } from './rimeArmour';
import { wintersShatterModule } from './wintersShatter';
import { tickBoltModule } from './tickBolt';
import { slowTimeModule } from './slowTime';
import { timeSkipModule } from './timeSkip';
import { stolenHourModule } from './stolenHour';
import { chainHammerModule } from './chainHammer';
import { forgeRoarModule } from './forgeRoar';
import { redHotRivetModule } from './redHotRivet';
import { moltenCoreModule } from './moltenCore';
import { resoundingChordModule } from './resoundingChord';
import { sirenSongModule } from './sirenSong';
import { risingChorusModule } from './risingChorus';
import { duetModule } from './duet';
import { burrowModule } from './burrow';
import { boneFanModule } from './boneFan';
import { raiseDeadModule } from './raiseDead';
import { boneArmourModule } from './boneArmour';
import { graveGraspModule } from './graveGrasp';
import { FOLDER_SPELLS } from '../../heroes/spells';

/**
 * The spells the game can play (src/game/main.ts registers these): every hero's, and the few a Raid boss or a Climb floor
 * casts by label (a ruler's 'burrow'). The tool page plays these and its showcases (index.ts, \`targetedModules\`).
 *
 * Kept out on purpose (docs/pipeline/hero-framework.md, "The start of the page"): the tool page's showcases, the spells of
 * heroes' earlier kits, and the test spells (src/kits/test.ts, a tool-page kit): no kit, passive, boss, floor or kept spell
 * names or imports them, so they were only weight in the game's first download. A spell a hero gets goes in its folder
 * (src/heroes/<theme>/fight.ts) or, for a hero not moved yet, here.
 */
export const gameModules: EffectModule[] = [
  tagOutModule,
  pomBackflipModule,
  pomSnareModule,
  pomPebbleModule,
  pimShieldUpModule,
  pimChargeModule,
  pimBonkModule,
  grandLobbyModule,
  doorSlamModule,
  wickDoorModule,
  keyTossModule,
  grandFinaleModule,
  hatTrickModule,
  sawnInHalfModule,
  cardSprayModule,
  stampedeModule,
  shearModule,
  spareSheepModule,
  crookWhackModule,
  severeWarningModule,
  forecastUpdateModule,
  lightningRiskModule,
  coldFrontModule,
  mrBiscuitModule,
  sweaterModule,
  castOnModule,
  knittingNeedleModule,
  sinkholeModule,
  moleTunnelModule,
  moleDigModule,
  moleClawModule,
  floodModule,
  mopBucketModule,
  wetFloorSignModule,
  bigMopModule,
  finalDeliveryModule,
  shortcutModule,
  fragileModule,
  expressLetterModule,
  dinnerIsServedModule,
  burntOfferingModule,
  hotSoupModule,
  thrownCleaverModule,
  showTheCardModule,
  noCastingModule,
  noRunningModule,
  whistleBlastModule,
  theBoxModule,
  ropeTrickModule,
  mimeWallModule,
  invisibleBallModule,
  saltThrowModule,
  sumoChargeModule,
  stompModule,
  palmStrikeModule,
  foreclosureModule,
  callItInModule,
  lateFeeModule,
  invoiceModule,
  landOnMyFeetModule,
  pounceModule,
  knockItOverModule,
  scratchModule,
  popPinModule,
  hotAirModule,
  heliumBombModule,
  airHoseModule,
  timberCallModule,
  caberTossModule,
  fastGrowthModule,
  axeSwingModule,
  geraldNoModule,
  aGoodLeanModule,
  theShoveModule,
  raiseGeraldModule,
  hallOfMirrorsModule,
  throughTheGlassModule,
  vanityStandModule,
  handMirrorModule,
  ricochetLightModule,
  crystalPillarModule,
  blindingFlareModule,
  shatterlightModule,
  inkLashModule,
  sealOfBindingModule,
  flowingScriptModule,
  theLastCharacterModule,
  gravitySlamModule,
  nullZoneModule,
  phaseStepModule,
  blackHoleModule,
  homingDroneModule,
  deployTurretModule,
  grappleHookModule,
  siegeModeModule,
  firstLightModule,
  dawnwardModule,
  oathbrandModule,
  sunriseModule,
  barbedStingerModule,
  hiveShellModule,
  swarmCloudModule,
  swarmSurgeModule,
  skyStrikeModule,
  thunderRodModule,
  polarityModule,
  supercellStormModule,
  icicleModule,
  hoarfrostModule,
  rimeArmourModule,
  wintersShatterModule,
  tickBoltModule,
  slowTimeModule,
  timeSkipModule,
  stolenHourModule,
  chainHammerModule,
  forgeRoarModule,
  redHotRivetModule,
  moltenCoreModule,
  resoundingChordModule,
  sirenSongModule,
  risingChorusModule,
  duetModule,
  burrowModule,
  boneFanModule,
  raiseDeadModule,
  boneArmourModule,
  graveGraspModule,
  // the heroes in folders of their own (src/heroes/<theme>/fight.ts)
  ...FOLDER_SPELLS,
];
