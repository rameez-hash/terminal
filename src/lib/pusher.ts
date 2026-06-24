import Pusher from "pusher";
import PusherClient from "pusher-js";

let pusherServer: Pusher | null = null;

function getPusherServer() {
  if (!pusherServer && process.env.PUSHER_APP_ID) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
      secret: process.env.PUSHER_SECRET || "",
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
      useTLS: true,
    });
  }
  return pusherServer;
}

export function getPusherClient() {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY || "", {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2",
  });
}

export async function broadcastEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
) {
  const pusher = getPusherServer();
  if (!pusher) return;
  try {
    await pusher.trigger(channel, event, data);
  } catch (error) {
    console.error("Pusher broadcast failed:", error);
  }
}
