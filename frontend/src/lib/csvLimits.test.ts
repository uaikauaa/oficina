import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTodosRegistrosRelatorio } from './csvExportHelper.ts';
import type { PageResponse } from './types.ts';

test('CSV refuses oversized exports without silently truncating or allocating the full dataset', async () => {
  let calls = 0;
  await assert.rejects(fetchTodosRegistrosRelatorio(async () => {
    calls++;
    return { content: [{ id: 1 }], totalElements: 10001, totalPages: 101, last: false } as PageResponse<{id: number}>;
  }), /10.000 registros/);
  assert.equal(calls, 1);
  await assert.rejects(fetchTodosRegistrosRelatorio(async () => { throw new Error('must not fetch'); }, 201), /pagina invalido/);
});
