import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import * as FreeIcons from "@hugeicons/core-free-icons";

type IconName = keyof typeof FreeIcons;
type Props = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;

const icons = {
  AlertCircle: "AlertCircleIcon",
  AlertTriangle: "TriangleAlertIcon",
  ArrowDown: "ArrowDownIcon",
  ArrowRightLeft: "ArrowLeftRightIcon",
  ArrowUp: "ArrowUpIcon",
  ArrowUpDown: "ArrowUpDownIcon",
  ArrowUpRight: "ArrowUpRightIcon",
  Ban: "BanIcon",
  Bookmark: "BookmarkIcon",
  BrainCircuit: "BrainCircuitIcon",
  Calendar: "CalendarIcon",
  Check: "CheckIcon",
  CheckCircle2: "CheckmarkCircle02Icon",
  ChevronDown: "ChevronDownIcon",
  ChevronDownIcon: "ChevronDownIcon",
  ChevronLeft: "ChevronLeftIcon",
  ChevronRight: "ChevronRightIcon",
  ChevronUpIcon: "ChevronUpIcon",
  ChevronsUpDownIcon: "ArrowUpDownIcon",
  CircleAlertIcon: "AlertCircleIcon",
  CircleCheckIcon: "CheckmarkCircle02Icon",
  Clock: "ClockIcon",
  Combine: "CombineIcon",
  Compass: "CompassIcon",
  Copy: "CopyIcon",
  Dices: "DicesIcon",
  ExternalLink: "ExternalLinkIcon",
  ExternalLinkIcon: "ExternalLinkIcon",
  Eye: "EyeIcon",
  Film: "FilmIcon",
  Flame: "FlameIcon",
  Frown: "Sad01Icon",
  Github: "GithubIcon",
  Globe: "GlobeIcon",
  Grid: "GridIcon",
  Heart: "FavouriteIcon",
  History: "Time04Icon",
  Info: "InformationCircleIcon",
  InfoIcon: "InformationCircleIcon",
  List: "ListViewIcon",
  ListOrdered: "Task01Icon",
  ListPlus: "AddToListIcon",
  Loader2: "Loading03Icon",
  LoaderCircleIcon: "Loading03Icon",
  Lock: "LockIcon",
  Meh: "NeutralIcon",
  Moon: "Moon02Icon",
  Pencil: "PencilEdit01Icon",
  Play: "PlayIcon",
  PlayCircle: "PlayCircleIcon",
  Plus: "Add01Icon",
  Radio: "RadioIcon",
  RefreshCw: "RefreshIcon",
  RotateCcw: "RotateLeftIcon",
  Search: "SearchIcon",
  Shield: "Shield01Icon",
  ShieldCheck: "ShieldCheckIcon",
  SlidersHorizontal: "SlidersHorizontalIcon",
  Smile: "HappyIcon",
  Sparkles: "SparklesIcon",
  Split: "SplitIcon",
  Star: "StarIcon",
  ThumbsDown: "ThumbsDownIcon",
  ThumbsUp: "ThumbsUpIcon",
  TicketIcon: "Ticket01Icon",
  ToggleLeft: "ToggleLeftIcon",
  Trash2: "Delete02Icon",
  TriangleAlertIcon: "TriangleAlertIcon",
  Tv: "Tv01Icon",
  UserCog: "UserSettings01Icon",
  UserX: "UserRemove01Icon",
  Users: "UserGroupIcon",
  X: "Cancel01Icon",
  XIcon: "Cancel01Icon",
  Zap: "ZapIcon",
} as const satisfies Record<string, IconName>;

function createIcon(iconName: IconName) {
  return function HugeiconsCompatIcon(props: Props) {
    // The compatibility layer resolves icon exports from its typed name map.
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: runtime map keeps the shared icon wrapper compact
    const icon = FreeIcons[iconName] as (typeof FreeIcons)[IconName];
    return <HugeiconsIcon icon={icon} {...props} />;
  };
}

export const AlertCircle = createIcon(icons.AlertCircle);
export const AlertTriangle = createIcon(icons.AlertTriangle);
export const ArrowDown = createIcon(icons.ArrowDown);
export const ArrowRightLeft = createIcon(icons.ArrowRightLeft);
export const ArrowUp = createIcon(icons.ArrowUp);
export const ArrowUpDown = createIcon(icons.ArrowUpDown);
export const ArrowUpRight = createIcon(icons.ArrowUpRight);
export const Ban = createIcon(icons.Ban);
export const Bookmark = createIcon(icons.Bookmark);
export const BrainCircuit = createIcon(icons.BrainCircuit);
export const Calendar = createIcon(icons.Calendar);
export const Check = createIcon(icons.Check);
export const CheckCircle2 = createIcon(icons.CheckCircle2);
export const ChevronDown = createIcon(icons.ChevronDown);
export const ChevronDownIcon = createIcon(icons.ChevronDownIcon);
export const ChevronLeft = createIcon(icons.ChevronLeft);
export const ChevronRight = createIcon(icons.ChevronRight);
export const ChevronUpIcon = createIcon(icons.ChevronUpIcon);
export const ChevronsUpDownIcon = createIcon(icons.ChevronsUpDownIcon);
export const CircleAlertIcon = createIcon(icons.CircleAlertIcon);
export const CircleCheckIcon = createIcon(icons.CircleCheckIcon);
export const Clock = createIcon(icons.Clock);
export const Combine = createIcon(icons.Combine);
export const Compass = createIcon(icons.Compass);
export const Copy = createIcon(icons.Copy);
export const Dices = createIcon(icons.Dices);
export const ExternalLink = createIcon(icons.ExternalLink);
export const ExternalLinkIcon = createIcon(icons.ExternalLinkIcon);
export const Eye = createIcon(icons.Eye);
export const Film = createIcon(icons.Film);
export const Flame = createIcon(icons.Flame);
export const Frown = createIcon(icons.Frown);
export const Github = createIcon(icons.Github);
export const Globe = createIcon(icons.Globe);
export const Grid = createIcon(icons.Grid);
export const Heart = createIcon(icons.Heart);
export const History = createIcon(icons.History);
export const Info = createIcon(icons.Info);
export const InfoIcon = createIcon(icons.InfoIcon);
export const List = createIcon(icons.List);
export const ListOrdered = createIcon(icons.ListOrdered);
export const ListPlus = createIcon(icons.ListPlus);
export const Loader2 = createIcon(icons.Loader2);
export const LoaderCircleIcon = createIcon(icons.LoaderCircleIcon);
export const Lock = createIcon(icons.Lock);
export const Meh = createIcon(icons.Meh);
export const Moon = createIcon(icons.Moon);
export const Pencil = createIcon(icons.Pencil);
export const Play = createIcon(icons.Play);
export const PlayCircle = createIcon(icons.PlayCircle);
export const Plus = createIcon(icons.Plus);
export const Radio = createIcon(icons.Radio);
export const RefreshCw = createIcon(icons.RefreshCw);
export const RotateCcw = createIcon(icons.RotateCcw);
export const Search = createIcon(icons.Search);
export const Shield = createIcon(icons.Shield);
export const ShieldCheck = createIcon(icons.ShieldCheck);
export const SlidersHorizontal = createIcon(icons.SlidersHorizontal);
export const Smile = createIcon(icons.Smile);
export const Sparkles = createIcon(icons.Sparkles);
export const Split = createIcon(icons.Split);
export const Star = createIcon(icons.Star);
export const Sun = createIcon("SunIcon");
export const ThumbsDown = createIcon(icons.ThumbsDown);
export const ThumbsUp = createIcon(icons.ThumbsUp);
export const TicketIcon = createIcon(icons.TicketIcon);
export const ToggleLeft = createIcon(icons.ToggleLeft);
export const Trash2 = createIcon(icons.Trash2);
export const TriangleAlertIcon = createIcon(icons.TriangleAlertIcon);
export const Tv = createIcon(icons.Tv);
export const UserCog = createIcon(icons.UserCog);
export const UserX = createIcon(icons.UserX);
export const Users = createIcon(icons.Users);
export const X = createIcon(icons.X);
export const XIcon = createIcon(icons.XIcon);
export const Zap = createIcon(icons.Zap);
