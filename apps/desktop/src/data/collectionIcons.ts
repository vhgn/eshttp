import {
  Bank,
  BracketsCurly,
  Briefcase,
  Bug,
  Cloud,
  Code,
  Cpu,
  Database,
  DesktopTower,
  FileCode,
  Flask,
  Folder,
  Folders,
  Gear,
  Globe,
  GlobeHemisphereWest,
  HardDrives,
  House,
  type Icon,
  Key,
  Lightning,
  Link,
  Lock,
  Network,
  Package,
  Plug,
  Rocket,
  ShoppingCart,
  Stack,
  Tag,
  Terminal,
  Truck,
  Users,
} from "@phosphor-icons/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export interface CollectionIconOption {
  id: string;
  label: string;
  icon: Icon;
}

export const COLLECTION_ICON_OPTIONS: CollectionIconOption[] = [
  { id: "folder", label: "Folder", icon: Folder },
  { id: "folders", label: "Folders", icon: Folders },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "region", label: "Region", icon: GlobeHemisphereWest },
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "database", label: "Database", icon: Database },
  { id: "storage", label: "Storage", icon: HardDrives },
  { id: "desktop", label: "Desktop", icon: DesktopTower },
  { id: "cpu", label: "CPU", icon: Cpu },
  { id: "network", label: "Network", icon: Network },
  { id: "plug", label: "Plug", icon: Plug },
  { id: "link", label: "Link", icon: Link },
  { id: "lightning", label: "Lightning", icon: Lightning },
  { id: "rocket", label: "Rocket", icon: Rocket },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "code", label: "Code", icon: Code },
  { id: "file-code", label: "File Code", icon: FileCode },
  { id: "braces", label: "Braces", icon: BracketsCurly },
  { id: "flask", label: "Flask", icon: Flask },
  { id: "bug", label: "Bug", icon: Bug },
  { id: "users", label: "Users", icon: Users },
  { id: "briefcase", label: "Briefcase", icon: Briefcase },
  { id: "house", label: "House", icon: House },
  { id: "bank", label: "Bank", icon: Bank },
  { id: "shopping", label: "Shopping", icon: ShoppingCart },
  { id: "package", label: "Package", icon: Package },
  { id: "truck", label: "Truck", icon: Truck },
  { id: "tag", label: "Tag", icon: Tag },
  { id: "stack", label: "Stack", icon: Stack },
  { id: "gear", label: "Gear", icon: Gear },
  { id: "lock", label: "Lock", icon: Lock },
  { id: "key", label: "Key", icon: Key },
];

export function getCollectionIconOption(iconId: string): CollectionIconOption | undefined {
  return COLLECTION_ICON_OPTIONS.find((entry) => entry.id === iconId);
}

export function renderCollectionIconSvg(icon: Icon, color: string): string {
  const raw = renderToStaticMarkup(
    createElement(icon, {
      size: 80,
      weight: "duotone",
      color,
    }),
  );

  if (raw.includes("xmlns=")) {
    return raw;
  }

  return raw.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
