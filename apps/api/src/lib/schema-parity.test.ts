import { readFileSync } from 'node:fs';
import { ORDER_STATUSES, USER_ROLES } from '@sportswear/shared';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');

function prismaEnumValues(name: string): string[] {
  const match = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  if (!match?.[1]) throw new Error(`enum ${name} tidak ditemukan di schema.prisma`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
}

describe('enum Prisma identik dengan packages/shared', () => {
  it('OrderStatus', () => {
    expect(prismaEnumValues('OrderStatus')).toEqual([...ORDER_STATUSES]);
  });

  it('UserRole', () => {
    expect(prismaEnumValues('UserRole')).toEqual([...USER_ROLES]);
  });
});
