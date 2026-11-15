import type {AnchorHTMLAttributes,ReactNode} from "react";
import {nativeHref,navigate} from "./navigation";
export default function Link({href,children,onClick,...props}:Omit<AnchorHTMLAttributes<HTMLAnchorElement>,"href">&{href:string;children?:ReactNode}){return <a {...props} href={nativeHref(href)} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&!props.target){e.preventDefault();navigate(href);}}}>{children}</a>;}
