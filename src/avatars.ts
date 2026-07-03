const modules = import.meta.glob<string>('./assets/avatars/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type AvatarOption = { file: string; url: string };

export const avatarOptions: AvatarOption[] = Object.entries(modules)
  .map(([path, url]) => ({ file: path.split('/').pop()!, url }))
  .sort((a, b) => a.file.localeCompare(b.file));

export function avatarUrl(file: string | null | undefined): string | null {
  return avatarOptions.find(a => a.file === file)?.url ?? null;
}
