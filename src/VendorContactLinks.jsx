import {
  ArrowUpRight,
  InstagramLogo,
  LinkSimple,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { vendorContacts } from "../plan-client.js";

export default function VendorContactLinks({ offer, compact = false }) {
  const contacts = vendorContacts(offer);
  if (!contacts.whatsapp && !contacts.instagram && !contacts.link) return null;
  const vendor = offer.vendor || offer.name || "vendor";
  return (
    <div
      className={`vendor-contact-links ${compact ? "compact" : ""}`}
      aria-label={`Kontak ${vendor}`}
    >
      {contacts.whatsapp && (
        <a
          className="button secondary"
          href={contacts.whatsapp.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${vendor} ${contacts.whatsapp.phone}`}
        >
          <WhatsappLogo size={17} />{" "}
          {compact ? "WhatsApp" : `WhatsApp · ${contacts.whatsapp.phone}`}
        </a>
      )}
      {contacts.instagram && (
        <a
          className="button secondary"
          href={contacts.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Instagram ${vendor}`}
        >
          <InstagramLogo size={17} /> Instagram <ArrowUpRight size={13} />
        </a>
      )}
      {contacts.link && (
        <a
          className="button secondary"
          href={contacts.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Tautan vendor ${vendor}`}
        >
          <LinkSimple size={17} /> Tautan vendor <ArrowUpRight size={13} />
        </a>
      )}
    </div>
  );
}
