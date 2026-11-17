import { Resend } from "resend";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

/** Pet and daycare names are user-typed, so they must never reach the HTML as markup. */
export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type PhotoEmail = {
  to: string;
  ownerName: string;
  petName: string;
  /** Shown as the sender's name; replies go to `replyTo`. */
  daycareName: string;
  replyTo: string;
  photoUrl: string;
};

/** Sends one photo (as a link plus a preview) to a pet's owner. Throws if sending fails. */
export async function sendPhotoEmail(email: PhotoEmail) {
  const pet = escapeHtml(email.petName);
  const owner = escapeHtml(email.ownerName);
  const daycare = escapeHtml(email.daycareName);
  const url = escapeHtml(email.photoUrl);

  const { error } = await getClient().emails.send({
    // Without a verified domain Resend only allows its own test sender, which can only
    // deliver to the Resend account's owner. Set RESEND_FROM once a domain is verified.
    from: `${email.daycareName.replace(/[<>"\r\n]/g, "")} <${process.env.RESEND_FROM ?? "onboarding@resend.dev"}>`,
    to: email.to,
    replyTo: email.replyTo,
    subject: `A new photo of ${email.petName}`,
    html: `<p>Hi ${owner},</p>
<p>${daycare} sent a new photo of ${pet}.</p>
<p><a href="${url}"><img src="${url}" alt="${pet}" width="480" style="max-width:100%;border-radius:8px"></a></p>
<p><a href="${url}">Open the photo</a> (the link works for 7 days).</p>`,
    text: `Hi ${email.ownerName},\n\n${email.daycareName} sent a new photo of ${email.petName}:\n${email.photoUrl}\n\n(The link works for 7 days.)`,
  });
  if (error) throw new Error(`Resend: ${error.name}`);
}

type PlainEmail = {
  to: string;
  /** The sender's display name, for example the daycare's or "PawK9". */
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

/** Sends a ready-made email. Throws if sending fails. */
export async function sendEmail(email: PlainEmail) {
  const { error } = await getClient().emails.send({
    // Same sender rules as sendPhotoEmail: RESEND_FROM once a domain is verified.
    from: `${email.fromName.replace(/[<>"\r\n]/g, "")} <${process.env.RESEND_FROM ?? "onboarding@resend.dev"}>`,
    to: email.to,
    replyTo: email.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(`Resend: ${error.name}`);
}
