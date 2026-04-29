import type { Database } from "@/lib/database.types"

type Tables = Database["public"]["Tables"]
type Enums = Database["public"]["Enums"]
type Functions = Database["public"]["Functions"]

export type Room = Tables["rooms"]["Row"]
export type Player = Tables["players"]["Row"]
export type RoundState = Tables["round_state"]["Row"]
export type RoundEvent = Tables["round_events"]["Row"]
export type RoundPosition = Tables["round_positions"]["Row"]
export type FootballPlayer = Tables["football_players"]["Row"]

export type RoomStatus = Enums["room_status"]
export type EventType = Enums["event_type"]

export type CreateRoomArgs = Functions["create_room"]["Args"]
export type CreateRoomResult = Functions["create_room"]["Returns"][number]
export type JoinRoomArgs = Functions["join_room"]["Args"]
export type JoinRoomResult = Functions["join_room"]["Returns"][number]
export type StartRoundArgs = Functions["start_round"]["Args"]
export type SubmitGuessArgs = Functions["submit_guess"]["Args"]
export type SubmitGuessResult = Functions["submit_guess"]["Returns"][number]
