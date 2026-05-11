# Issue Tracker

| Issue | Title                                                          | Status | Branch | PR | Rubric     | Notes |
|-------|----------------------------------------------------------------|--------|--------|----|------------|-------|
| #1    | Lobby: host configurable max_rounds/score_positions/category   | :green_circle: | feat/1-lobby-host-settings-rounds-topn-category | https://github.com/adisak1618/footballer-guesser/pull/4 | 4349510098 | merged |
| #2    | Playing: GuessResult Correct/Foul transition                   | :green_circle: | fix/2-correct-foul-result-transition | https://github.com/adisak1618/footballer-guesser/pull/5 | 4349510233 | merged |
| #3    | Guess input: autocomplete / typo-tolerance                     | :green_circle: | feat/3-guess-input-typo-tolerance | https://github.com/adisak1618/footballer-guesser/pull/6 | 4349510351 | merged |
| #7    | Rematch: settings not persisted + game-2 scoreboard stall      | :green_circle: | fix/7-rematch-settings-and-game2-stall | https://github.com/adisak1618/footballer-guesser/pull/10 | 4350638674 | merged |
| #8    | GuessResult: non-top-N correct mislabeled as ทายผิด            | :green_circle: | fix/8-guess-result-correct-zero-pts | https://github.com/adisak1618/footballer-guesser/pull/9 | 4350638829 | merged |
| #17   | Insider: multi-round scoring system (5-round match)            | :green_circle: | feat/17-insider-multi-round-scoring | https://github.com/adisak1618/footballer-guesser/pull/22 | 4413279081 | merged |
| #23   | Insider: show round counter X/Y during play                    | :green_circle: | feat/23-round-counter-during-play | https://github.com/adisak1618/footballer-guesser/pull/25 | 4414990529 | merged |
| #24   | Insider: between-rounds + game-end UX                          | :green_circle: | feat/24-insider-between-rounds-game-end-ux | https://github.com/adisak1618/footballer-guesser/pull/26 | 4414990561 | merged (migrations 0036/0037, 26 new tests) |
| #27   | feat(platform): unified RoomSetupPanel + Category terminology  | :green_circle: | feat/27-unified-room-setup-panel-category | https://github.com/adisak1618/footballer-guesser/pull/28 | 4418725383 | merged (migration 0038 rounds_locked + change_insider_max_rounds RPC, packages/ui RoomSetupPanel, both apps migrated, /new deleted, Pack→Category UI rename) |
| #29   | Headball: direct room link should prompt for name              | :large_blue_circle: | feat/29-headball-direct-link-name-prompt | https://github.com/adisak1618/footballer-guesser/pull/30 | 4423434304 | QA PASS; gates /room/[code] with Insider-style name prompt, blocks PLAYING/ENDED with Thai error, returning members refresh-safe |

Status legend:
- :red_circle: Not started
- :yellow_circle: In progress (agent dispatched)
- :pause_button: Waiting for clarification
- :large_blue_circle: PR open, awaiting human review
- :green_circle: Verified and merged
- :x: Failed
- :no_entry: BLOCKED — grooming failed or re-groom loop exhausted
- :arrows_counterclockwise: Re-grooming — dev reported REGROOM_REQUIRED; transient
