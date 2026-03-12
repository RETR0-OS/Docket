export interface CommandMeta {
  name: string;
  hint: string;
  template: string;
}

export const COMMANDS: CommandMeta[] = [
  {
    name: 'availability',
    hint: 'Show free slots for current + next week',
    template: '::availability::',
  },
  {
    name: 'schedule',
    hint: '::schedule <type> <title> <YYYY-MM-DD> <HH:MM> <HH:MM>::',
    template: '::schedule type title YYYY-MM-DD HH:MM HH:MM::',
  },
  {
    name: 'appointments',
    hint: '::appointments <YYYY-MM-DD>::',
    template: '::appointments YYYY-MM-DD::',
  },
  {
    name: 'reschedule',
    hint: '::reschedule <name> <YYYY-MM-DD> <HH:MM> <HH:MM>::',
    template: '::reschedule name YYYY-MM-DD HH:MM HH:MM::',
  },
  {
    name: 'cancel',
    hint: '::cancel <name> <YYYY-MM-DD> <HH:MM> <HH:MM>::',
    template: '::cancel name YYYY-MM-DD HH:MM HH:MM::',
  },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);
