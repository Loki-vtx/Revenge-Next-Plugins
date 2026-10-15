import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'

const ApplicationCommandType = {
	CHAT: 1,
	USER: 2,
	MESSAGE: 3,
} as const

const ApplicationCommandInputType = {
	BUILT_IN: 0,
	BUILT_IN_TEXT: 1,
	BUILT_IN_INTEGRATION: 2,
	BOT: 3,
	PLACEHOLDER: 4,
} as const

interface CommandContext {
	channel: { id: string }
}

interface ApplicationCommandOption {
	name: string
	description: string
	displayName?: string
	displayDescription?: string
	type: number
	required?: boolean
}

interface ApplicationCommand {
	id?: string
	name: string
	displayName?: string
	untranslatedName?: string
	description: string
	displayDescription?: string
	untranslatedDescription?: string
	options: ApplicationCommandOption[]
	execute(args: unknown[], ctx: CommandContext): unknown
	applicationId?: string
	inputType?: number
	type?: number
}

interface CommandsModule {
	getBuiltInCommands(
		type: number | number[],
		...rest: unknown[]
	): ApplicationCommand[]
}

interface MessageUtil {
	sendMessage(
		channelId: string,
		message: { content: string },
		invalidEmojis?: undefined,
		options?: { nonce?: string },
	): unknown
	editMessage(...args: unknown[]): unknown
}

interface FrecencySettingsModule {
	FrecencyUserSettingsActionCreators?: {
		getCurrentValue?: () => {
			favoriteGifs?: { gifs?: Record<string, unknown> }
		}
	}
}

let commands: ApplicationCommand[] = []

const NoFavorites =
	"❌ You don't have any favorite GIFs! Add some by favoriting GIFs in Discord first."

export default plugin({
	start({ cleanup }) {
		let messageUtil: MessageUtil | undefined
		let frecency: FrecencySettingsModule | undefined

		function getMessage(): string {
			const store =
				frecency?.FrecencyUserSettingsActionCreators?.getCurrentValue?.()
			const gifs = store?.favoriteGifs?.gifs
			if (!gifs) return NoFavorites

			const urls = Object.keys(gifs)
			if (urls.length === 0) return NoFavorites

			return urls[Math.floor(Math.random() * urls.length)]!
		}

		function registerCommand(
			commandsModule: CommandsModule,
			command: ApplicationCommand,
		): () => void {
			let builtInCommands: ApplicationCommand[]
			try {
				builtInCommands = commandsModule.getBuiltInCommands(
					ApplicationCommandType.CHAT,
					true,
					false,
				)
			} catch {
				builtInCommands = commandsModule.getBuiltInCommands(
					Object.values(ApplicationCommandType),
					true,
					false,
				)
			}

			builtInCommands.sort(
				(a, b) => parseInt(b.id ?? '0', 10) - parseInt(a.id ?? '0', 10),
			)

			const lastCommand = builtInCommands[builtInCommands.length - 1]
			if (lastCommand?.id)
				command.id = (parseInt(lastCommand.id, 10) - 1).toString()

			command.applicationId ??= '-1'
			command.type ??= ApplicationCommandType.CHAT
			command.inputType = ApplicationCommandInputType.BUILT_IN_TEXT
			command.displayName ??= command.name
			command.untranslatedName ??= command.name
			command.displayDescription ??= command.description
			command.untranslatedDescription ??= command.description

			commands.push(command)

			return () => {
				commands = commands.filter(c => c.id !== command.id)
			}
		}

		function patchBuiltInCommands(commandsModule: CommandsModule): () => void {
			return instead(
				commandsModule as any,
				'getBuiltInCommands',
				(args: any[], original: (...a: any[]) => any) => {
					const result: ApplicationCommand[] =
						original.apply(commandsModule, args) ?? []

					const type = args[0]
					const wanted: number[] = Array.isArray(type) ? type : [type]

					return [
						...result,
						...commands.filter(c =>
							wanted.includes(c.type ?? ApplicationCommandType.CHAT),
						),
					]
				},
			)
		}

		cleanup(
			getModules(
				withProps<MessageUtil>('sendMessage', 'editMessage'),
				mod => {
					messageUtil = mod
				},
			),
			getModules(
				withProps<FrecencySettingsModule>('FrecencyUserSettingsActionCreators'),
				mod => {
					frecency = mod
				},
			),
			getModules(withProps<CommandsModule>('getBuiltInCommands'), Commands => {
				cleanup(patchBuiltInCommands(Commands))
				cleanup(
					registerCommand(Commands, {
						name: 'gifroulette',
						displayName: 'GIF Roulette',
						description: 'Sends a random GIF from your favorites',
						options: [],
						execute: (_args, ctx) => {
							messageUtil?.sendMessage(
								ctx.channel.id,
								{ content: getMessage() },
								void 0,
								{ nonce: Date.now().toString() },
							)
						},
					}),
				)
			}),
			() => {
				commands = []
			},
		)
	},
})
