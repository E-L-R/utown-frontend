import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { MenuDish, MenuOptionGroup } from '../types/api';
import { cx, dishArt, formatMoney } from '../lib/format';
import { Art, Modal, QuantityStepper, Spinner } from './ui';

/** Radio when the group allows exactly one pick (or is required without an explicit max). */
const isSingle = (g: MenuOptionGroup) => g.maxSelections === 1 || (g.required && g.maxSelections == null);
const minFor = (g: MenuOptionGroup) => g.minSelections ?? (g.required ? 1 : 0);

interface Props {
  dish: MenuDish | null;
  cuisineHints: (string | null | undefined)[];
  onClose: () => void;
  onConfirm: (dish: MenuDish, quantity: number, optionIds: number[]) => void;
  submitting: boolean;
}

export function DishOptionsModal({ dish, cuisineHints, onClose, onConfirm, submitting }: Props) {
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [qty, setQty] = useState(1);

  // Reset, and preselect the first available option of required single-choice groups.
  useEffect(() => {
    if (!dish) return;
    const init: Record<number, number[]> = {};
    for (const g of dish.optionGroups) {
      const first = g.options.find((o) => o.status === 'AVAILABLE');
      init[g.id] = isSingle(g) && g.required && first ? [first.id] : [];
    }
    setSelected(init);
    setQty(1);
  }, [dish]);

  const toggle = (g: MenuOptionGroup, optionId: number) =>
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      if (isSingle(g)) return { ...prev, [g.id]: cur[0] === optionId && !g.required ? [] : [optionId] };
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (g.maxSelections && cur.length >= g.maxSelections) return prev;
      return { ...prev, [g.id]: [...cur, optionId] };
    });

  const { unit, missing } = useMemo(() => {
    if (!dish) return { unit: 0, missing: [] as string[] };
    let extra = 0;
    const miss: string[] = [];
    for (const g of dish.optionGroups) {
      const ids = selected[g.id] ?? [];
      if (ids.length < minFor(g)) miss.push(g.name);
      for (const o of g.options) if (ids.includes(o.id)) extra += Number(o.additionalPrice);
    }
    return { unit: Number(dish.price) + extra, missing: miss };
  }, [dish, selected]);

  if (!dish) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={dish.name}
      footer={
        <>
          <QuantityStepper value={qty} onChange={setQty} large />
          <button
            id="confirm-add-to-cart"
            className="btn btn--primary btn--lg grow"
            disabled={missing.length > 0 || submitting}
            onClick={() => onConfirm(dish, qty, Object.values(selected).flat())}
          >
            {submitting ? <Spinner /> : missing.length ? `Choose ${missing[0].toLowerCase()}` : `Add to bag · ${formatMoney(unit * qty)}`}
          </button>
        </>
      }
    >
      <Art art={dishArt(dish.name, ...cuisineHints)} src={dish.imageUrl} alt={dish.name} className="modal__art" />
      {dish.description && <p className="muted">{dish.description}</p>}
      <p className="strong" style={{ marginTop: 8 }}>{formatMoney(dish.price)}</p>

      {dish.optionGroups.map((g) => {
        const single = isSingle(g);
        const ids = selected[g.id] ?? [];
        return (
          <fieldset key={g.id} className="opt-group">
            <legend>
              <span>{g.name}</span>
              <span className={cx('chip', g.required && 'chip--accent')}>
                {g.required ? 'Required' : 'Optional'}
                {!single && g.maxSelections ? ` · up to ${g.maxSelections}` : ''}
              </span>
            </legend>
            {g.options.map((o) => {
              const unavailable = o.status !== 'AVAILABLE';
              const checked = ids.includes(o.id);
              return (
                <label key={o.id} className={cx('opt', checked && 'is-checked', unavailable && 'is-disabled')}>
                  <input
                    type={single ? 'radio' : 'checkbox'}
                    name={`group-${g.id}`}
                    checked={checked}
                    disabled={unavailable}
                    onChange={() => toggle(g, o.id)}
                  />
                  <span className={cx('opt__control', single ? 'is-radio' : 'is-check')}>
                    {checked && !single && <Check size={13} strokeWidth={3.5} />}
                  </span>
                  <span className="grow">
                    {o.name}
                    {unavailable && <em className="muted small"> · sold out</em>}
                  </span>
                  <span className="muted small">{Number(o.additionalPrice) > 0 ? `+${formatMoney(o.additionalPrice)}` : 'Included'}</span>
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </Modal>
  );
}
