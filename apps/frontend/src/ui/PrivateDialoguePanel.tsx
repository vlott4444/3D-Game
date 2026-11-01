import type { ComponentProps } from "react";
import DialoguePanel from "./DialoguePanel";

// The shared large modal keeps a private conversation tied to the approached NPC.
// The server sends this channel only to the authenticated owner.
export default function PrivateDialoguePanel(
  props: ComponentProps<typeof DialoguePanel>,
) {
  return <DialoguePanel {...props} />;
}
