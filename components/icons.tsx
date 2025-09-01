import * as React from "react";

import { IconSvgProps } from "@/types";
export type IconProps = IconSvgProps;

export const Logo: React.FC<IconSvgProps> = ({ ...props }) => (
  <svg
    fill="none"
    height={24}
    viewBox="0 0 364 364"
    width={24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g>
      <g>
        <path
          d="m223.925 77.34-13.391 13.391c-.717.718-.716 1.675.002 2.393l73.988 73.988c8.141 8.142 8.15 21.541.02 29.672l-73.891 73.89c-.717.718-.717 1.675.002 2.393l13.409 13.409c9.577 9.578 24.892 9.588 34.457.023l87.281-87.282c9.565-9.565 9.555-24.879-.023-34.457l-87.636-87.636c-9.338-9.339-24.652-9.349-34.218.216m-70.341 13.354-13.408-13.409c-9.578-9.578-24.892-9.588-34.458-.023l-87.52 87.521c-9.565 9.565-9.555 24.879.023 34.457l87.636 87.636c9.578 9.578 24.892 9.588 34.457.023l13.63-13.63c.718-.718.717-1.675-.001-2.393l-73.988-73.988c-8.141-8.141-8.15-21.541-.02-29.671l73.89-73.89c.478-.958.478-1.915-.241-2.633"
          fill="url(#a)"
        />
        <path
          d="m180.764 119.993-44.478 44.478c-9.565 9.565-9.555 24.879.023 34.457l44.297 44.297c.718.719 1.675.719 2.393.002l44.716-44.717c9.565-9.565 9.555-24.879-.022-34.457l-44.537-44.537c-.718-.239-1.675-.24-2.392.477"
          fill="url(#b)"
        />
      </g>
    </g>
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="a"
        x1="181.88"
        x2="181.641"
        y1="0.981"
        y2="363.019"
      >
        <stop offset="0.05" stopColor="#67D7FE" />
        <stop offset="0.95" stopColor="#6F6EF9" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="b"
        x1="181.761"
        x2="181.522"
        y1="0.591"
        y2="362.629"
      >
        <stop offset="0.05" stopColor="#67D7FE" />
        <stop offset="0.95" stopColor="#6F6EF9" />
      </linearGradient>
    </defs>
  </svg>
);

export const MoonFilledIcon = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 22c5.523 0 10-4.477 10-10c0-.463-.694-.54-.933-.143a6.5 6.5 0 1 1-8.924-8.924C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10"
      fill="currentColor"
    />
  </svg>
);

export const SunFilledIcon = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M18 12a6 6 0 1 1-12 0a6 6 0 0 1 12 0" fill="currentColor" />
    <path
      clipRule="evenodd"
      d="M12 1.25a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0V2a.75.75 0 0 1 .75-.75M4.399 4.399a.75.75 0 0 1 1.06 0l.393.392a.75.75 0 0 1-1.06 1.061l-.393-.393a.75.75 0 0 1 0-1.06m15.202 0a.75.75 0 0 1 0 1.06l-.393.393a.75.75 0 0 1-1.06-1.06l.393-.393a.75.75 0 0 1 1.06 0M1.25 12a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75m19 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75m-2.102 6.148a.75.75 0 0 1 1.06 0l.393.393a.75.75 0 1 1-1.06 1.06l-.393-.393a.75.75 0 0 1 0-1.06m-12.296 0a.75.75 0 0 1 0 1.06l-.393.393a.75.75 0 1 1-1.06-1.06l.392-.393a.75.75 0 0 1 1.061 0M12 20.25a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const SearchFilledIcon = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M21.788 21.788a.723.723 0 0 0 0-1.022L18.122 17.1a9.157 9.157 0 1 0-1.022 1.022l3.666 3.666a.723.723 0 0 0 1.022 0"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const SearchIcon = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M11.5 2.75a8.75 8.75 0 1 0 0 17.5a8.75 8.75 0 0 0 0-17.5M1.25 11.5c0-5.66 4.59-10.25 10.25-10.25S21.75 5.84 21.75 11.5c0 2.56-.939 4.902-2.491 6.698l3.271 3.272a.75.75 0 1 1-1.06 1.06l-3.272-3.271A10.2 10.2 0 0 1 11.5 21.75c-5.66 0-10.25-4.59-10.25-10.25"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const BookMarkFilledIcon = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M21 11.098v4.993c0 3.096 0 4.645-.734 5.321c-.35.323-.792.526-1.263.58c-.987.113-2.14-.907-4.445-2.946c-1.02-.901-1.529-1.352-2.118-1.47a2.2 2.2 0 0 0-.88 0c-.59.118-1.099.569-2.118 1.47c-2.305 2.039-3.458 3.059-4.445 2.945a2.24 2.24 0 0 1-1.263-.579C3 20.736 3 19.188 3 16.091v-4.994C3 6.81 3 4.666 4.318 3.333S7.758 2 12 2s6.364 0 7.682 1.332S21 6.81 21 11.098M8.25 6A.75.75 0 0 1 9 5.25h6a.75.75 0 0 1 0 1.5H9A.75.75 0 0 1 8.25 6"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const BookMarkIcon = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M3 11.098v4.993c0 3.096 0 4.645.734 5.321c.35.323.792.526 1.263.58c.987.113 2.14-.907 4.445-2.946c1.02-.901 1.529-1.352 2.118-1.47c.29-.06.59-.06.88 0c.59.118 1.099.569 2.118 1.47c2.305 2.039 3.458 3.059 4.445 2.945c.47-.053.913-.256 1.263-.579c.734-.676.734-2.224.734-5.321v-4.994c0-4.288 0-6.432-1.318-7.765S16.242 2 12 2S5.636 2 4.318 3.332C3.511 4.148 3.198 5.27 3.077 7M15 6H9"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
    />
  </svg>
);

export const ArrowLeftLine = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M15.488 4.43a.75.75 0 0 1 .081 1.058L9.988 12l5.581 6.512a.75.75 0 1 1-1.138.976l-6-7a.75.75 0 0 1 0-.976l6-7a.75.75 0 0 1 1.057-.081"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const ArrowRightLine = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M8.512 4.43a.75.75 0 0 1 1.057.082l6 7a.75.75 0 0 1 0 .976l-6 7a.75.75 0 0 1-1.138-.976L14.012 12L8.431 5.488a.75.75 0 0 1 .08-1.057"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const Star = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M9.153 5.408C10.42 3.136 11.053 2 12 2s1.58 1.136 2.847 3.408l.328.588c.36.646.54.969.82 1.182s.63.292 1.33.45l.636.144c2.46.557 3.689.835 3.982 1.776c.292.94-.546 1.921-2.223 3.882l-.434.507c-.476.557-.715.836-.822 1.18c-.107.345-.071.717.001 1.46l.066.677c.253 2.617.38 3.925-.386 4.506s-1.918.051-4.22-1.009l-.597-.274c-.654-.302-.981-.452-1.328-.452s-.674.15-1.328.452l-.596.274c-2.303 1.06-3.455 1.59-4.22 1.01c-.767-.582-.64-1.89-.387-4.507l.066-.676c.072-.744.108-1.116 0-1.46c-.106-.345-.345-.624-.821-1.18l-.434-.508c-1.677-1.96-2.515-2.941-2.223-3.882S3.58 8.328 6.04 7.772l.636-.144c.699-.158 1.048-.237 1.329-.45s.46-.536.82-1.182z"
      fill="currentColor"
    />
  </svg>
);

export const Upload = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M6.5 18v-.09c0-.865 0-1.659.087-2.304c.095-.711.32-1.463.938-2.08c.618-.619 1.37-.844 2.08-.94c.646-.086 1.44-.086 2.306-.086h.178c.866 0 1.66 0 2.305.087c.711.095 1.463.32 2.08.938c.619.618.844 1.37.94 2.08c.085.637.086 1.416.086 2.267c2.573-.55 4.5-2.812 4.5-5.52c0-2.47-1.607-4.572-3.845-5.337C17.837 4.194 15.415 2 12.476 2C9.32 2 6.762 4.528 6.762 7.647c0 .69.125 1.35.354 1.962a4.4 4.4 0 0 0-.83-.08C3.919 9.53 2 11.426 2 13.765S3.919 18 6.286 18z"
      fill="currentColor"
    />
    <path
      clipRule="evenodd"
      d="M12 14c-1.886 0-2.828 0-3.414.586S8 16.114 8 18s0 2.828.586 3.414S10.114 22 12 22s2.828 0 3.414-.586S16 19.886 16 18s0-2.828-.586-3.414S13.886 14 12 14m1.805 3.084l-1.334-1.333a.667.667 0 0 0-.942 0l-1.334 1.333a.667.667 0 1 0 .943.943l.195-.195v1.946a.667.667 0 0 0 1.334 0v-1.946l.195.195a.667.667 0 0 0 .943-.943"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const Download = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M12 22c-1.886 0-2.828 0-3.414-.586S8 19.886 8 18s0-2.828.586-3.414S10.114 14 12 14s2.828 0 3.414.586S16 16.114 16 18s0 2.828-.586 3.414S13.886 22 12 22m1.805-3.084l-1.334 1.333a.667.667 0 0 1-.942 0l-1.334-1.333a.667.667 0 1 1 .943-.943l.195.195v-1.946a.667.667 0 0 1 1.334 0v1.946l.195-.195a.667.667 0 0 1 .943.943"
      fill="currentColor"
      fillRule="evenodd"
    />
    <path
      d="M6.5 18v-.09c0-.865 0-1.659.087-2.304c.095-.711.32-1.463.938-2.08c.618-.619 1.37-.844 2.08-.94c.646-.086 1.44-.086 2.306-.086h.178c.866 0 1.66 0 2.305.087c.711.095 1.463.32 2.08.938c.619.618.844 1.37.94 2.08c.085.637.086 1.416.086 2.267c2.573-.55 4.5-2.812 4.5-5.52c0-2.47-1.607-4.572-3.845-5.337C17.837 4.194 15.415 2 12.476 2C9.32 2 6.762 4.528 6.762 7.647c0 .69.125 1.35.354 1.962a4.4 4.4 0 0 0-.83-.08C3.919 9.53 2 11.426 2 13.765S3.919 18 6.286 18z"
      fill="currentColor"
    />
  </svg>
);

export const ArrowLeft = ({ ...props }: IconSvgProps) => (
  <svg
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M20 12H4m0 0l6-6m-6 6l6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    />
  </svg>
);

export const ShareBold = ({ ...props }: IconSvgProps) => (
  <svg
    height={24}
    viewBox="0 0 24 24"
    width={24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      clipRule="evenodd"
      d="M13.803 5.333c0-1.84 1.5-3.333 3.348-3.333A3.34 3.34 0 0 1 20.5 5.333c0 1.841-1.5 3.334-3.349 3.334a3.35 3.35 0 0 1-2.384-.994l-4.635 3.156a3.34 3.34 0 0 1-.182 1.917l5.082 3.34a3.35 3.35 0 0 1 2.12-.753a3.34 3.34 0 0 1 3.348 3.334C20.5 20.507 19 22 17.151 22a3.34 3.34 0 0 1-3.348-3.333a3.3 3.3 0 0 1 .289-1.356L9.05 14a3.35 3.35 0 0 1-2.202.821A3.34 3.34 0 0 1 3.5 11.487a3.34 3.34 0 0 1 3.348-3.333c1.064 0 2.01.493 2.623 1.261l4.493-3.059a3.3 3.3 0 0 1-.161-1.023"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const Play = ({ ...props }: IconSvgProps) => (
  <svg
    height={24}
    viewBox="0 0 24 24"
    width={24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M21.409 9.353a2.998 2.998 0 0 1 0 5.294L8.597 21.614C6.534 22.737 4 21.277 4 18.968V5.033c0-2.31 2.534-3.769 4.597-2.648z"
      fill="currentColor"
    />
  </svg>
);

export const XIcon = ({ ...props }: IconSvgProps) => (
  <svg
    fill="none"
    height={24}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width={24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const TrashBin = ({ ...props }: IconSvgProps) => (
  <svg
    height={24}
    viewBox="0 0 24 24"
    width={24}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M3 6.386c0-.484.345-.877.771-.877h2.665c.529-.016.996-.399 1.176-.965l.03-.1l.115-.391c.07-.24.131-.45.217-.637c.338-.739.964-1.252 1.687-1.383c.184-.033.378-.033.6-.033h3.478c.223 0 .417 0 .6.033c.723.131 1.35.644 1.687 1.383c.086.187.147.396.218.637l.114.391l.03.1c.18.566.74.95 1.27.965h2.57c.427 0 .772.393.772.877s-.345.877-.771.877H3.77c-.425 0-.77-.393-.77-.877"
      fill="currentColor"
    />
    <path
      clipRule="evenodd"
      d="M11.596 22h.808c2.783 0 4.174 0 5.08-.886c.904-.886.996-2.339 1.181-5.245l.267-4.188c.1-1.577.15-2.366-.303-2.865c-.454-.5-1.22-.5-2.753-.5H8.124c-1.533 0-2.3 0-2.753.5s-.404 1.288-.303 2.865l.267 4.188c.185 2.906.277 4.36 1.182 5.245c.905.886 2.296.886 5.079.886m-1.35-9.811c-.04-.434-.408-.75-.82-.707c-.413.043-.713.43-.672.864l.5 5.263c.04.434.408.75.82.707c.413-.043.713-.43.672-.864zm4.329-.707c.412.043.713.43.671.864l-.5 5.263c-.04.434-.409.75-.82.707c-.413-.043-.713-.43-.672-.864l.5-5.263c.04-.434.409-.75.82-.707"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);
