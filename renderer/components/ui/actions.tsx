import {
  IconBox,
  IconLine,
  IconLineDashed,
  IconSquare,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Data = {
  appVersion: string;
  isNotMac: boolean;
};

function Actions() {
  const [data, setData] = useState<Data>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window?.ipc?.invoke("getActionsData").then((response) => {
      setData(response);
    });
  }, []);

  return (
    <div className="drag absolute top-0 z-50 flex h-11 w-full items-center justify-end px-8 py-2.5">
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="flex h-full items-center gap-2">
          <Image
            src={"/assets/Logo [Dark].ico"}
            alt="logo"
            width={16}
            height={16}
            className="hidden dark:block"
          />
          <Image
            src={"/assets/Logo.ico"}
            className="block dark:hidden"
            alt="logo"
            width={16}
            height={16}
          />
          Wora
        </div>
        <div className="no-drag absolute -right-2 top-0 flex h-full items-center gap-2.5">
          {data?.isNotMac && (
            <>
              <Button
                variant="ghost"
                onClick={() => window.ipc.send("minimizeWindow", true)}
              >
                <IconLineDashed size={14} stroke={2} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsMaximized(!isMaximized);
                  window.ipc.send("maximizeWindow", !isMaximized);
                }}
              >
                <IconSquare size={11} stroke={2} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => window.ipc.send("quitApp", true)}
              >
                <IconX size={14} stroke={2} />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Actions;
