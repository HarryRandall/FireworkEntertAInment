/** Catalogue metadata and validated stored designs for the built-in effect library. */
import { upgradeDesign, type Design } from '../schema/index';
import peony from './peony.json' with { type: 'json' };
import dahlia from './dahlia.json' with { type: 'json' };
import chrysanthemum from './chrysanthemum.json' with { type: 'json' };
import willow from './willow.json' with { type: 'json' };
import brocade from './brocade.json' with { type: 'json' };
import kamuro from './kamuro.json' with { type: 'json' };
import horsetail from './horsetail.json' with { type: 'json' };
import palm from './palm.json' with { type: 'json' };
import crossette from './crossette.json' with { type: 'json' };
import ring from './ring.json' with { type: 'json' };
import strobe from './strobe.json' with { type: 'json' };
import crackle from './crackle.json' with { type: 'json' };
import pistil from './pistil.json' with { type: 'json' };
import neutron from './neutron.json' with { type: 'json' };
import ghost from './ghost.json' with { type: 'json' };
import glitter from './glitter.json' with { type: 'json' };
import fallingLeaves from './fallingLeaves.json' with { type: 'json' };
import fish from './fish.json' with { type: 'json' };
import bees from './bees.json' with { type: 'json' };
import multiBreak from './multiBreak.json' with { type: 'json' };
import salute from './salute.json' with { type: 'json' };
import comet from './comet.json' with { type: 'json' };
import mine from './mine.json' with { type: 'json' };
import fountain from './fountain.json' with { type: 'json' };
import tourbillon from './tourbillon.json' with { type: 'json' };
import redGold from './redGold.json' with { type: 'json' };
import greenWhite from './greenWhite.json' with { type: 'json' };
import redLace from './redLace.json' with { type: 'json' };
import crackleChrys from './crackleChrys.json' with { type: 'json' };
import whiteComet from './whiteComet.json' with { type: 'json' };
import greenComets from './greenComets.json' with { type: 'json' };
import goldToBlue from './goldToBlue.json' with { type: 'json' };
import glitterMine from './glitterMine.json' with { type: 'json' };
import peonyRedGreen from './peonyRedGreen.json' with { type: 'json' };
import peonyChange from './peonyChange.json' with { type: 'json' };
import rainbow from './rainbow.json' with { type: 'json' };
import silverChrys from './silverChrys.json' with { type: 'json' };
import chrysTips from './chrysTips.json' with { type: 'json' };
import greenWillow from './greenWillow.json' with { type: 'json' };
import silverKamuro from './silverKamuro.json' with { type: 'json' };
import timeRain from './timeRain.json' with { type: 'json' };
import coconut from './coconut.json' with { type: 'json' };
import spider from './spider.json' with { type: 'json' };
import redCrossette from './redCrossette.json' with { type: 'json' };
import saturn from './saturn.json' with { type: 'json' };
import doubleRing from './doubleRing.json' with { type: 'json' };
import heart from './heart.json' with { type: 'json' };
import purplePistil from './purplePistil.json' with { type: 'json' };
import dragonEggs from './dragonEggs.json' with { type: 'json' };
import greenStrobe from './greenStrobe.json' with { type: 'json' };
import brocadeComets from './brocadeComets.json' with { type: 'json' };
import randomComets from './randomComets.json' with { type: 'json' };
import silverMine from './silverMine.json' with { type: 'json' };
import crackleMine from './crackleMine.json' with { type: 'json' };
import silverFountain from './silverFountain.json' with { type: 'json' };
import sprayFountain from './sprayFountain.json' with { type: 'json' };
import tourbillons from './tourbillons.json' with { type: 'json' };
import brocadeCrown from './brocadeCrown.json' with { type: 'json' };
import jellyfish from './jellyfish.json' with { type: 'json' };
import snowflakes from './snowflakes.json' with { type: 'json' };
import spiral from './spiral.json' with { type: 'json' };
import waterfall from './waterfall.json' with { type: 'json' };
import wave from './wave.json' with { type: 'json' };
import whirlwind from './whirlwind.json' with { type: 'json' };
import firefly from './firefly.json' with { type: 'json' };
import flitter from './flitter.json' with { type: 'json' };
import bouquet from './bouquet.json' with { type: 'json' };
import floral from './floral.json' with { type: 'json' };
import rings from './rings.json' with { type: 'json' };
import parachute from './parachute.json' with { type: 'json' };
import risingTail from './risingTail.json' with { type: 'json' };
import whistleShell from './whistleShell.json' with { type: 'json' };
import silverDragon from './silverDragon.json' with { type: 'json' };
import romanCandle from './romanCandle.json' with { type: 'json' };
import bombettes from './bombettes.json' with { type: 'json' };
import skyRocket from './skyRocket.json' with { type: 'json' };
import bottleRocket from './bottleRocket.json' with { type: 'json' };
import missile from './missile.json' with { type: 'json' };
import helicopter from './helicopter.json' with { type: 'json' };
import wheel from './wheel.json' with { type: 'json' };
import spinners from './spinners.json' with { type: 'json' };
import cone from './cone.json' with { type: 'json' };
import sparkler from './sparkler.json' with { type: 'json' };
import brocadeTips from './brocadeTips.json' with { type: 'json' };
import glitterWillow from './glitterWillow.json' with { type: 'json' };
import pearls from './pearls.json' with { type: 'json' };
import cometCrossette from './cometCrossette.json' with { type: 'json' };
import tigerTail from './tigerTail.json' with { type: 'json' };
import strobePistil from './strobePistil.json' with { type: 'json' };
import multiTails from './multiTails.json' with { type: 'json' };
import glitterHorsetail from './glitterHorsetail.json' with { type: 'json' };
import whistleCake from './whistleCake.json' with { type: 'json' };
import crackPalm from './crackPalm.json' with { type: 'json' };
import niagara from './niagara.json' with { type: 'json' };
import zFan from './zFan.json' with { type: 'json' };
import dahliaStrobe from './dahliaStrobe.json' with { type: 'json' };
import poppingFlowers from './poppingFlowers.json' with { type: 'json' };
import twinkleSilver from './twinkleSilver.json' with { type: 'json' };
import rocketFlowers from './rocketFlowers.json' with { type: 'json' };

export type EffectTemplateKey =
  | 'peony'
  | 'dahlia'
  | 'chrysanthemum'
  | 'willow'
  | 'brocade'
  | 'kamuro'
  | 'horsetail'
  | 'palm'
  | 'crossette'
  | 'ring'
  | 'strobe'
  | 'crackle'
  | 'pistil'
  | 'neutron'
  | 'ghost'
  | 'glitter'
  | 'fallingLeaves'
  | 'fish'
  | 'bees'
  | 'multiBreak'
  | 'salute'
  | 'comet'
  | 'mine'
  | 'fountain'
  | 'tourbillon'
  | 'redGold'
  | 'greenWhite'
  | 'redLace'
  | 'crackleChrys'
  | 'whiteComet'
  | 'greenComets'
  | 'goldToBlue'
  | 'glitterMine'
  | 'peonyRedGreen'
  | 'peonyChange'
  | 'rainbow'
  | 'silverChrys'
  | 'chrysTips'
  | 'greenWillow'
  | 'silverKamuro'
  | 'timeRain'
  | 'coconut'
  | 'spider'
  | 'redCrossette'
  | 'saturn'
  | 'doubleRing'
  | 'heart'
  | 'purplePistil'
  | 'dragonEggs'
  | 'greenStrobe'
  | 'brocadeComets'
  | 'randomComets'
  | 'silverMine'
  | 'crackleMine'
  | 'silverFountain'
  | 'sprayFountain'
  | 'tourbillons'
  | 'brocadeCrown'
  | 'jellyfish'
  | 'snowflakes'
  | 'spiral'
  | 'waterfall'
  | 'wave'
  | 'whirlwind'
  | 'firefly'
  | 'flitter'
  | 'bouquet'
  | 'floral'
  | 'rings'
  | 'parachute'
  | 'risingTail'
  | 'whistleShell'
  | 'silverDragon'
  | 'romanCandle'
  | 'bombettes'
  | 'skyRocket'
  | 'bottleRocket'
  | 'missile'
  | 'helicopter'
  | 'wheel'
  | 'spinners'
  | 'cone'
  | 'sparkler'
  | 'brocadeTips'
  | 'glitterWillow'
  | 'pearls'
  | 'cometCrossette'
  | 'tigerTail'
  | 'strobePistil'
  | 'multiTails'
  | 'glitterHorsetail'
  | 'whistleCake'
  | 'crackPalm'
  | 'niagara'
  | 'zFan'
  | 'dahliaStrobe'
  | 'poppingFlowers'
  | 'twinkleSilver'
  | 'rocketFlowers';
export type EffectTemplateGroup =
  | 'Shells'
  | 'Ground'
  | 'Signature'
  | 'Variations'
  | 'Rockets and candles'
  | 'Display effects';

/** Catalogue identity stays outside the renderer's design document. */
export interface EffectTemplate {
  readonly key: EffectTemplateKey;
  readonly name: string;
  readonly group: EffectTemplateGroup;
  readonly design: Design;
}

/** Built-in templates in prototype catalogue order, validated on loading. */
export const effectTemplates: readonly EffectTemplate[] = [
  { key: 'peony', name: peony.name, group: 'Shells', design: upgradeDesign(peony.design, 1) },
  { key: 'dahlia', name: dahlia.name, group: 'Shells', design: upgradeDesign(dahlia.design, 1) },
  {
    key: 'chrysanthemum',
    name: chrysanthemum.name,
    group: 'Shells',
    design: upgradeDesign(chrysanthemum.design, 1),
  },
  { key: 'willow', name: willow.name, group: 'Shells', design: upgradeDesign(willow.design, 1) },
  { key: 'brocade', name: brocade.name, group: 'Shells', design: upgradeDesign(brocade.design, 1) },
  { key: 'kamuro', name: kamuro.name, group: 'Shells', design: upgradeDesign(kamuro.design, 1) },
  {
    key: 'horsetail',
    name: horsetail.name,
    group: 'Shells',
    design: upgradeDesign(horsetail.design, 1),
  },
  { key: 'palm', name: palm.name, group: 'Shells', design: upgradeDesign(palm.design, 1) },
  {
    key: 'crossette',
    name: crossette.name,
    group: 'Shells',
    design: upgradeDesign(crossette.design, 1),
  },
  { key: 'ring', name: ring.name, group: 'Shells', design: upgradeDesign(ring.design, 1) },
  { key: 'strobe', name: strobe.name, group: 'Shells', design: upgradeDesign(strobe.design, 1) },
  { key: 'crackle', name: crackle.name, group: 'Shells', design: upgradeDesign(crackle.design, 1) },
  { key: 'pistil', name: pistil.name, group: 'Shells', design: upgradeDesign(pistil.design, 1) },
  { key: 'neutron', name: neutron.name, group: 'Shells', design: upgradeDesign(neutron.design, 1) },
  { key: 'ghost', name: ghost.name, group: 'Shells', design: upgradeDesign(ghost.design, 1) },
  { key: 'glitter', name: glitter.name, group: 'Shells', design: upgradeDesign(glitter.design, 1) },
  {
    key: 'fallingLeaves',
    name: fallingLeaves.name,
    group: 'Shells',
    design: upgradeDesign(fallingLeaves.design, 1),
  },
  { key: 'fish', name: fish.name, group: 'Shells', design: upgradeDesign(fish.design, 1) },
  { key: 'bees', name: bees.name, group: 'Shells', design: upgradeDesign(bees.design, 1) },
  {
    key: 'multiBreak',
    name: multiBreak.name,
    group: 'Shells',
    design: upgradeDesign(multiBreak.design, 1),
  },
  { key: 'salute', name: salute.name, group: 'Shells', design: upgradeDesign(salute.design, 1) },
  { key: 'comet', name: comet.name, group: 'Ground', design: upgradeDesign(comet.design, 1) },
  { key: 'mine', name: mine.name, group: 'Ground', design: upgradeDesign(mine.design, 1) },
  {
    key: 'fountain',
    name: fountain.name,
    group: 'Ground',
    design: upgradeDesign(fountain.design, 1),
  },
  {
    key: 'tourbillon',
    name: tourbillon.name,
    group: 'Ground',
    design: upgradeDesign(tourbillon.design, 1),
  },
  {
    key: 'redGold',
    name: redGold.name,
    group: 'Signature',
    design: upgradeDesign(redGold.design, 1),
  },
  {
    key: 'greenWhite',
    name: greenWhite.name,
    group: 'Signature',
    design: upgradeDesign(greenWhite.design, 1),
  },
  {
    key: 'redLace',
    name: redLace.name,
    group: 'Signature',
    design: upgradeDesign(redLace.design, 1),
  },
  {
    key: 'crackleChrys',
    name: crackleChrys.name,
    group: 'Signature',
    design: upgradeDesign(crackleChrys.design, 1),
  },
  {
    key: 'whiteComet',
    name: whiteComet.name,
    group: 'Signature',
    design: upgradeDesign(whiteComet.design, 1),
  },
  {
    key: 'greenComets',
    name: greenComets.name,
    group: 'Signature',
    design: upgradeDesign(greenComets.design, 1),
  },
  {
    key: 'goldToBlue',
    name: goldToBlue.name,
    group: 'Signature',
    design: upgradeDesign(goldToBlue.design, 1),
  },
  {
    key: 'glitterMine',
    name: glitterMine.name,
    group: 'Signature',
    design: upgradeDesign(glitterMine.design, 1),
  },
  {
    key: 'peonyRedGreen',
    name: peonyRedGreen.name,
    group: 'Variations',
    design: upgradeDesign(peonyRedGreen.design, 1),
  },
  {
    key: 'peonyChange',
    name: peonyChange.name,
    group: 'Variations',
    design: upgradeDesign(peonyChange.design, 1),
  },
  {
    key: 'rainbow',
    name: rainbow.name,
    group: 'Variations',
    design: upgradeDesign(rainbow.design, 1),
  },
  {
    key: 'silverChrys',
    name: silverChrys.name,
    group: 'Variations',
    design: upgradeDesign(silverChrys.design, 1),
  },
  {
    key: 'chrysTips',
    name: chrysTips.name,
    group: 'Variations',
    design: upgradeDesign(chrysTips.design, 1),
  },
  {
    key: 'greenWillow',
    name: greenWillow.name,
    group: 'Variations',
    design: upgradeDesign(greenWillow.design, 1),
  },
  {
    key: 'silverKamuro',
    name: silverKamuro.name,
    group: 'Variations',
    design: upgradeDesign(silverKamuro.design, 1),
  },
  {
    key: 'timeRain',
    name: timeRain.name,
    group: 'Shells',
    design: upgradeDesign(timeRain.design, 1),
  },
  { key: 'coconut', name: coconut.name, group: 'Shells', design: upgradeDesign(coconut.design, 1) },
  { key: 'spider', name: spider.name, group: 'Shells', design: upgradeDesign(spider.design, 1) },
  {
    key: 'redCrossette',
    name: redCrossette.name,
    group: 'Variations',
    design: upgradeDesign(redCrossette.design, 1),
  },
  { key: 'saturn', name: saturn.name, group: 'Shells', design: upgradeDesign(saturn.design, 1) },
  {
    key: 'doubleRing',
    name: doubleRing.name,
    group: 'Variations',
    design: upgradeDesign(doubleRing.design, 1),
  },
  { key: 'heart', name: heart.name, group: 'Variations', design: upgradeDesign(heart.design, 1) },
  {
    key: 'purplePistil',
    name: purplePistil.name,
    group: 'Variations',
    design: upgradeDesign(purplePistil.design, 1),
  },
  {
    key: 'dragonEggs',
    name: dragonEggs.name,
    group: 'Variations',
    design: upgradeDesign(dragonEggs.design, 1),
  },
  {
    key: 'greenStrobe',
    name: greenStrobe.name,
    group: 'Variations',
    design: upgradeDesign(greenStrobe.design, 1),
  },
  {
    key: 'brocadeComets',
    name: brocadeComets.name,
    group: 'Variations',
    design: upgradeDesign(brocadeComets.design, 1),
  },
  {
    key: 'randomComets',
    name: randomComets.name,
    group: 'Variations',
    design: upgradeDesign(randomComets.design, 1),
  },
  {
    key: 'silverMine',
    name: silverMine.name,
    group: 'Variations',
    design: upgradeDesign(silverMine.design, 1),
  },
  {
    key: 'crackleMine',
    name: crackleMine.name,
    group: 'Variations',
    design: upgradeDesign(crackleMine.design, 1),
  },
  {
    key: 'silverFountain',
    name: silverFountain.name,
    group: 'Variations',
    design: upgradeDesign(silverFountain.design, 1),
  },
  {
    key: 'sprayFountain',
    name: sprayFountain.name,
    group: 'Variations',
    design: upgradeDesign(sprayFountain.design, 1),
  },
  {
    key: 'tourbillons',
    name: tourbillons.name,
    group: 'Variations',
    design: upgradeDesign(tourbillons.design, 1),
  },
  {
    key: 'brocadeCrown',
    name: brocadeCrown.name,
    group: 'Shells',
    design: upgradeDesign(brocadeCrown.design, 1),
  },
  {
    key: 'jellyfish',
    name: jellyfish.name,
    group: 'Shells',
    design: upgradeDesign(jellyfish.design, 1),
  },
  {
    key: 'snowflakes',
    name: snowflakes.name,
    group: 'Shells',
    design: upgradeDesign(snowflakes.design, 1),
  },
  { key: 'spiral', name: spiral.name, group: 'Shells', design: upgradeDesign(spiral.design, 1) },
  {
    key: 'waterfall',
    name: waterfall.name,
    group: 'Shells',
    design: upgradeDesign(waterfall.design, 1),
  },
  { key: 'wave', name: wave.name, group: 'Shells', design: upgradeDesign(wave.design, 1) },
  {
    key: 'whirlwind',
    name: whirlwind.name,
    group: 'Shells',
    design: upgradeDesign(whirlwind.design, 1),
  },
  { key: 'firefly', name: firefly.name, group: 'Shells', design: upgradeDesign(firefly.design, 1) },
  { key: 'flitter', name: flitter.name, group: 'Shells', design: upgradeDesign(flitter.design, 1) },
  { key: 'bouquet', name: bouquet.name, group: 'Shells', design: upgradeDesign(bouquet.design, 1) },
  { key: 'floral', name: floral.name, group: 'Shells', design: upgradeDesign(floral.design, 1) },
  { key: 'rings', name: rings.name, group: 'Shells', design: upgradeDesign(rings.design, 1) },
  {
    key: 'parachute',
    name: parachute.name,
    group: 'Shells',
    design: upgradeDesign(parachute.design, 1),
  },
  {
    key: 'risingTail',
    name: risingTail.name,
    group: 'Shells',
    design: upgradeDesign(risingTail.design, 1),
  },
  {
    key: 'whistleShell',
    name: whistleShell.name,
    group: 'Shells',
    design: upgradeDesign(whistleShell.design, 1),
  },
  {
    key: 'silverDragon',
    name: silverDragon.name,
    group: 'Rockets and candles',
    design: upgradeDesign(silverDragon.design, 1),
  },
  {
    key: 'romanCandle',
    name: romanCandle.name,
    group: 'Rockets and candles',
    design: upgradeDesign(romanCandle.design, 1),
  },
  {
    key: 'bombettes',
    name: bombettes.name,
    group: 'Rockets and candles',
    design: upgradeDesign(bombettes.design, 1),
  },
  {
    key: 'skyRocket',
    name: skyRocket.name,
    group: 'Rockets and candles',
    design: upgradeDesign(skyRocket.design, 1),
  },
  {
    key: 'bottleRocket',
    name: bottleRocket.name,
    group: 'Rockets and candles',
    design: upgradeDesign(bottleRocket.design, 1),
  },
  {
    key: 'missile',
    name: missile.name,
    group: 'Rockets and candles',
    design: upgradeDesign(missile.design, 1),
  },
  {
    key: 'helicopter',
    name: helicopter.name,
    group: 'Rockets and candles',
    design: upgradeDesign(helicopter.design, 1),
  },
  { key: 'wheel', name: wheel.name, group: 'Ground', design: upgradeDesign(wheel.design, 1) },
  {
    key: 'spinners',
    name: spinners.name,
    group: 'Ground',
    design: upgradeDesign(spinners.design, 1),
  },
  { key: 'cone', name: cone.name, group: 'Ground', design: upgradeDesign(cone.design, 1) },
  {
    key: 'sparkler',
    name: sparkler.name,
    group: 'Ground',
    design: upgradeDesign(sparkler.design, 1),
  },
  {
    key: 'brocadeTips',
    name: brocadeTips.name,
    group: 'Display effects',
    design: upgradeDesign(brocadeTips.design, 1),
  },
  {
    key: 'glitterWillow',
    name: glitterWillow.name,
    group: 'Display effects',
    design: upgradeDesign(glitterWillow.design, 1),
  },
  {
    key: 'pearls',
    name: pearls.name,
    group: 'Display effects',
    design: upgradeDesign(pearls.design, 1),
  },
  {
    key: 'cometCrossette',
    name: cometCrossette.name,
    group: 'Display effects',
    design: upgradeDesign(cometCrossette.design, 1),
  },
  {
    key: 'tigerTail',
    name: tigerTail.name,
    group: 'Display effects',
    design: upgradeDesign(tigerTail.design, 1),
  },
  {
    key: 'strobePistil',
    name: strobePistil.name,
    group: 'Display effects',
    design: upgradeDesign(strobePistil.design, 1),
  },
  {
    key: 'multiTails',
    name: multiTails.name,
    group: 'Display effects',
    design: upgradeDesign(multiTails.design, 1),
  },
  {
    key: 'glitterHorsetail',
    name: glitterHorsetail.name,
    group: 'Display effects',
    design: upgradeDesign(glitterHorsetail.design, 1),
  },
  {
    key: 'whistleCake',
    name: whistleCake.name,
    group: 'Display effects',
    design: upgradeDesign(whistleCake.design, 1),
  },
  {
    key: 'crackPalm',
    name: crackPalm.name,
    group: 'Display effects',
    design: upgradeDesign(crackPalm.design, 1),
  },
  {
    key: 'niagara',
    name: niagara.name,
    group: 'Display effects',
    design: upgradeDesign(niagara.design, 1),
  },
  { key: 'zFan', name: zFan.name, group: 'Display effects', design: upgradeDesign(zFan.design, 1) },
  {
    key: 'dahliaStrobe',
    name: dahliaStrobe.name,
    group: 'Display effects',
    design: upgradeDesign(dahliaStrobe.design, 1),
  },
  {
    key: 'poppingFlowers',
    name: poppingFlowers.name,
    group: 'Display effects',
    design: upgradeDesign(poppingFlowers.design, 1),
  },
  {
    key: 'twinkleSilver',
    name: twinkleSilver.name,
    group: 'Display effects',
    design: upgradeDesign(twinkleSilver.design, 1),
  },
  {
    key: 'rocketFlowers',
    name: rocketFlowers.name,
    group: 'Display effects',
    design: upgradeDesign(rocketFlowers.design, 1),
  },
];

export { TEMPLATE_HEIGHT_BANDS, templateApexM } from './height-bands';
