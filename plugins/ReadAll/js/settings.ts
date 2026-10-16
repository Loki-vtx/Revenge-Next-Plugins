import { createStore, findByProps, findByStoreName, getReact, getRN, toast, useStore } from "./compat";

export const store = createStore("readallplus", {
  excludedServers: [] as string[],
  excludedDMs: [] as string[],
});

export const isServerExcluded = (id: string) => store.data.excludedServers.includes(id);
export const isDMExcluded = (id: string) => store.data.excludedDMs.includes(id);

const serverName = (id: string) => {
  try {
    const guild = findByStoreName("GuildStore")?.getGuild?.(id);
    return guild?.name ? `${guild.name} (${id})` : id;
  } catch {
    return id;
  }
};

const dmName = (id: string) => {
  try {
    const channel = findByStoreName("ChannelStore")?.getChannel?.(id);
    if (channel?.name) return `${channel.name} (${id})`;
    const first = channel?.recipients?.[0];
    if (first) {
      const user = findByStoreName("UserStore")?.getUser?.(first);
      return user?.username ? `@${user.username} (${id})` : id;
    }
  } catch {}
  return id;
};

export default function Settings() {
  const React = getReact();
  const RN = getRN();
  const h = React.createElement;
  const { ScrollView } = findByProps("ScrollView");
  const { TableRowGroup, TableRow, Stack, TextInput } = findByProps(
    "TableRowGroup",
    "TableRow",
    "Stack",
    "TextInput"
  );

  const data = useStore(store);
  const [serverInput, setServerInput] = React.useState("");
  const [dmInput, setDmInput] = React.useState("");

  const section = (
    kind: "excludedServers" | "excludedDMs",
    title: string,
    listTitle: string,
    placeholder: string,
    addLabel: string,
    addSub: string,
    input: string,
    setInput: (v: string) => void,
    nameOf: (id: string) => string
  ) => {
    const add = () => {
      const id = input.trim();
      if (!id) return toast("Please enter an ID");
      if (data[kind].includes(id)) return toast("Already excluded");
      store.set(kind, [...data[kind], id]);
      setInput("");
      toast("Exception added");
    };
    const remove = (id: string) => {
      store.set(kind, data[kind].filter((x) => x !== id));
      toast("Exception removed");
    };

    return [
      h(
        TableRowGroup,
        { key: `${kind}-in`, title },
        h(
          Stack,
          { spacing: 4 },
          h(TextInput, {
            placeholder,
            value: input,
            onChange: setInput,
            isClearable: true,
            onSubmitEditing: add,
            returnKeyType: "done",
          })
        )
      ),
      h(
        TableRowGroup,
        { key: `${kind}-add` },
        h(TableRow, {
          label: addLabel,
          subLabel: addSub,
          trailing: h(TableRow.Arrow),
          onPress: add,
        })
      ),
      data[kind].length > 0 &&
        h(
          TableRowGroup,
          { key: `${kind}-list`, title: listTitle },
          data[kind].map((id) =>
            h(TableRow, {
              key: id,
              label: nameOf(id),
              trailing: h(
                RN.TouchableOpacity,
                { onPress: () => remove(id) },
                h(RN.Text, { style: { color: "#ff4d4d", fontSize: 18 } }, "✕")
              ),
            })
          )
        ),
    ];
  };

  return h(
    ScrollView,
    { style: { flex: 1 }, contentContainerStyle: { padding: 10 } },
    h(
      Stack,
      { spacing: 8 },
      h(
        TableRowGroup,
        { title: "Read All+ Info" },
        h(TableRow, {
          label: "What is this?",
          subLabel: "Mark all unread servers and DMs as read with one click, excluding listed IDs",
        })
      ),
      ...section(
        "excludedServers",
        "Exclude Server",
        "Excluded Servers",
        "Enter Server ID",
        "Add Server Exception",
        "Prevent this server from being marked as read",
        serverInput,
        setServerInput,
        serverName
      ),
      ...section(
        "excludedDMs",
        "Exclude DM / Group",
        "Excluded DMs",
        "Enter Channel ID",
        "Add DM Exception",
        "Prevent this channel from being marked as read",
        dmInput,
        setDmInput,
        dmName
      )
    )
  );
}
