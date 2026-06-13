declare module "bcryptjs" {
  export function hashSync(
    data: string,
    saltOrRounds: string | number,
  ): string;

  export function compareSync(data: string, encrypted: string): boolean;

  const bcrypt: {
    hashSync: typeof hashSync;
    compareSync: typeof compareSync;
  };

  export default bcrypt;
}
