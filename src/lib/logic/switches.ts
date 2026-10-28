import type { Bit } from './types';

/**
 * A network of switch contacts. A contact on switch S is closed when S = 1
 * ('no', normally open) or when S = 0 ('nc', the other throw of a two-way switch).
 */
export type ContactNet =
  | { type: 'contact'; switch: string; closedWhen: Bit }
  | { type: 'series'; parts: ContactNet[] }
  | { type: 'parallel'; parts: ContactNet[] };

/**
 * 'series': the lamp lights when the network conducts.
 * 'shunt': the network is wired across the lamp (with a protective resistor in
 * series with the battery), so a conducting network short-circuits the lamp and
 * it goes out.
 */
export interface SwitchCircuitModel {
  lamp: 'series' | 'shunt';
  net: ContactNet;
}

export function conducts(net: ContactNet, switches: Record<string, Bit>): Bit {
  switch (net.type) {
    case 'contact': {
      const s = switches[net.switch];
      if (s !== 0 && s !== 1) throw new Error(`No position for switch ${net.switch}`);
      return s === net.closedWhen ? 1 : 0;
    }
    case 'series':
      return net.parts.every((p) => conducts(p, switches) === 1) ? 1 : 0;
    case 'parallel':
      return net.parts.some((p) => conducts(p, switches) === 1) ? 1 : 0;
  }
}

export function lampState(model: SwitchCircuitModel, switches: Record<string, Bit>): Bit {
  const c = conducts(model.net, switches);
  return model.lamp === 'series' ? c : c === 1 ? 0 : 1;
}

export const no = (s: string): ContactNet => ({ type: 'contact', switch: s, closedWhen: 1 });
export const nc = (s: string): ContactNet => ({ type: 'contact', switch: s, closedWhen: 0 });
export const series = (...parts: ContactNet[]): ContactNet => ({ type: 'series', parts });
export const parallel = (...parts: ContactNet[]): ContactNet => ({ type: 'parallel', parts });

/** The seven switch circuits from the notes (N p.19). */
export const GATE_SWITCH_CIRCUITS = {
  AND: { lamp: 'series', net: series(no('S1'), no('S2')) },
  OR: { lamp: 'series', net: parallel(no('S1'), no('S2')) },
  NOT: { lamp: 'shunt', net: no('S') },
  NAND: { lamp: 'shunt', net: series(no('S1'), no('S2')) },
  NOR: { lamp: 'shunt', net: parallel(no('S1'), no('S2')) },
  // Two-way switches, cross-wired: the lamp is on when the switches are in different positions.
  XOR: { lamp: 'series', net: parallel(series(no('S1'), nc('S2')), series(nc('S1'), no('S2'))) },
  // Two-way switches, straight-wired: on when both switches are in the same position.
  XNOR: { lamp: 'series', net: parallel(series(no('S1'), no('S2')), series(nc('S1'), nc('S2'))) },
} as const satisfies Record<string, SwitchCircuitModel>;
