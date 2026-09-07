import { routes } from "@/shared/config/routes";
import { Button, type ButtonSize } from "@/shared/ui/button";

type Props = Readonly<{
  size?: ButtonSize;
  className?: string;
}>;

export function SignOutForm({ size = "sm", className }: Props) {
  return (
    <form action={routes.signOut} method="post" className={className}>
      <Button type="submit" variant="secondary" size={size}>
        Sair
      </Button>
    </form>
  );
}
