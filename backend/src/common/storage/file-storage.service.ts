import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const STORAGE_ROOT = join(process.cwd(), 'uploads');

/**
 * Adapter mínimo de almacenamiento de documentos, a disco local. Cumple el
 * requisito de conservar el archivo original (docs/04 §9, docs/02 §7),
 * pero es un placeholder deliberado: docs/02-arquitectura.md §1 y §8
 * proponen S3/MinIO para producción y múltiples sucursales. La interfaz
 * (save/read por key) está pensada para que ese reemplazo sea un simple
 * cambio de implementación, sin tocar los servicios que la consumen.
 */
@Injectable()
export class FileStorageService {
  async save(buffer: Buffer, folder: string, extension: string): Promise<string> {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const key = `${folder}/${hash}${extension}`;
    const fullPath = join(STORAGE_ROOT, key);

    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, buffer);

    return key;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(join(STORAGE_ROOT, key));
  }

  hash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
