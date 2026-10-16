import { choose, findByProps, findByStoreName, getReact, getRN, toast } from "./compat";
import { isDMExcluded, isServerExcluded } from "./settings";

export const TILE = 48;
export const MARGIN = 4;

type Mode = "all" | "servers" | "dms";

const getStores = () => ({
  GuildStore: findByStoreName("GuildStore"),
  GuildChannelStore: findByStoreName("GuildChannelStore") || findByStoreName("ChannelStore"),
  ChannelStore: findByStoreName("ChannelStore"),
  ReadStateStore: findByStoreName("ReadStateStore"),
  FluxDispatcher: findByProps("dispatch", "subscribe"),
});

const getDMChannels = (ChannelStore: any, GuildChannelStore: any) => {
  const out: any[] = [];
  const store = ChannelStore || GuildChannelStore;
  try {
    const priv = store?.getPrivateChannels?.();
    if (priv && typeof priv === "object") {
      Object.values(priv).forEach((c: any) => c?.id && out.push(c));
    }
  } catch {}
  return out;
};

const getUnreadChannels = (mode: Mode) => {
  const { GuildStore, GuildChannelStore, ChannelStore, ReadStateStore } = getStores();
  if (!ReadStateStore) return [];

  const channels: any[] = [];
  const push = (id: string) =>
    channels.push({
      channelId: id,
      messageId: ReadStateStore.lastMessageId?.(id) || null,
      readStateType: 0,
    });

  if ((mode === "all" || mode === "servers") && GuildStore) {
    Object.values(GuildStore.getGuilds()).forEach((guild: any) => {
      if (!guild?.id || isServerExcluded(guild.id)) return;
      try {
        let list: any[] = [];
        const data = (GuildChannelStore || ChannelStore)?.getChannels?.(guild.id);
        if (data?.SELECTABLE) list = list.concat(data.SELECTABLE);
        if (data?.VOCAL) list = list.concat(data.VOCAL);
        list.forEach((c: any) => {
          const channel = c?.channel || c;
          if (channel?.id && ReadStateStore.hasUnread?.(channel.id)) push(channel.id);
        });
      } catch {}
    });
  }

  if (mode === "all" || mode === "dms") {
    getDMChannels(ChannelStore, GuildChannelStore).forEach((channel) => {
      if (!isDMExcluded(channel.id) && ReadStateStore.hasUnread?.(channel.id)) push(channel.id);
    });
  }

  return channels;
};

const executeClear = (mode: Mode) => {
  const { FluxDispatcher } = getStores();
  const targets = getUnreadChannels(mode);
  if (targets.length === 0) return toast("No unread notifications!");

  FluxDispatcher.dispatch({ type: "BULK_ACK", context: "APP", channels: targets });

  const label = mode === "all" ? "notifications" : mode === "servers" ? "server channels" : "DMs";
  toast(`Cleared ${targets.length} ${label}!`);
};

export default function ReadButton() {
  const React = getReact();
  const RN = getRN();
  const h = React.createElement;
  const Haptic = findByProps("triggerHapticFeedback", "HapticFeedbackTypes");

  const onPress = () => {
    Haptic?.triggerHapticFeedback?.(Haptic.HapticFeedbackTypes.SOFT);
    choose("👁️ Read All Options", "Choose what you want to mark as read:", [
      { text: "Mark All Read", onPress: () => executeClear("all") },
      { text: "Servers Only", onPress: () => executeClear("servers") },
      { text: "DMs Only", onPress: () => executeClear("dms") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const st = RN.StyleSheet.create({
    row: { alignSelf: "stretch", alignItems: "center", paddingTop: MARGIN, paddingBottom: MARGIN },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: 16,
      backgroundColor: "#111214",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    circle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#2B2D31",
      alignItems: "center",
      justifyContent: "center",
    },
  });

  return h(
    RN.View,
    { style: st.row },
    h(
      RN.Pressable,
      { onPress, accessibilityRole: "button", accessibilityLabel: "Read All Options" },
      h(
        RN.View,
        { style: st.tile },
        h(RN.View, { style: st.circle }, h(RN.Text, { style: { fontSize: 18 } }, "👁"))
      )
    )
  );
}
