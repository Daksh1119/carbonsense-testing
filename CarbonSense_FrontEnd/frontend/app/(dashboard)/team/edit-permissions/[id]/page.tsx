import { redirect } from "next/navigation";

interface Props {
  params: { id: string };
}

export default function TeamEditPermissionsRedirect({ params }: Props) {
  redirect(`/team-management/edit-permissions/${params.id}`);
}
