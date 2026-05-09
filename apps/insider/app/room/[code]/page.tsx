import { Lobby } from "./lobby"

export const dynamic = "force-dynamic"

export default async function InsiderRoomPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  return <Lobby code={code} />
}
