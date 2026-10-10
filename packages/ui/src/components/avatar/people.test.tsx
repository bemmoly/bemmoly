import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { Label } from '../label/label.tsx';
import { Avatar, UnassignedAvatar } from './avatar.tsx';

describe('Avatar', () => {
  it('draws white initials at 42% of its size on a solid colour', () => {
    render(<Avatar name="Aisha Khan" hue="sky" size={24} />);
    const avatar = screen.getByRole('img', { name: 'Aisha Khan' });
    expect(avatar.textContent).toBe('AK');
    expect(avatar.style.fontSize).toBe('10px');
    expect(avatar.className).toContain('bg-avatar-sky');
    expect(avatar.className).toContain('text-on-solid');
  });

  it('draws nobody as a dashed ring', () => {
    render(<UnassignedAvatar size={18} />);
    expect(screen.getByRole('img', { name: 'Unassigned' }).className).toContain('border-dashed');
  });
});

describe('Label', () => {
  it('is an outlined pill with the stored colour as its dot', async () => {
    const onRemove = vi.fn();
    const { container } = render(<Label name="security" color="#c2536a" onRemove={onRemove} />);
    expect(container.querySelector('i')?.getAttribute('style')).toContain('background');
    fireEvent.click(screen.getByRole('button', { name: 'Remove label security' }));
    expect(onRemove).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });
});
