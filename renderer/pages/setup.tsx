import Actions from "@/components/ui/actions";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { IconArrowRight } from "@tabler/icons-react";
import { useRouter } from "next/router";
import Spinner from "@/components/ui/spinner";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Setup() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSelectMusicFolder = () => {
    setLoading(true);

    window.ipc
      .invoke("scanLibrary", true)
      .then((response) => {
        if (response?.canceled) {
          setLoading(false);
          return;
        }

        router.push("/home");
      })
      .catch((error) => {
        console.error("Error setting up music folder:", error);
        toast(t("setup.errors.music_folder_failed"));
        setLoading(false);
      });
  };

  return (
    <div className="wora-transition h-screen w-screen">
      <Actions />
      <div className="relative flex h-full w-full items-center overflow-hidden p-8 select-none">
        <div className="absolute -bottom-36 -left-32 h-96 w-96 rounded-full bg-black blur-[1700px] dark:bg-white" />
        <div className="z-10 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Image
              src="/assets/Full [Dark].png"
              width={124}
              height={0}
              alt="logo"
              className="hidden dark:block"
            />
            <Image
              src="/assets/Full.png"
              width={124}
              height={0}
              alt="logo"
              className="block dark:hidden"
            />
            <div className="flex items-center text-sm opacity-50">
              {t("setup.subtitle")}
            </div>
          </div>
          <Button
            className="w-fit"
            onClick={handleSelectMusicFolder}
            disabled={loading}
          >
            {t("setup.select_folder")}
            {loading ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <IconArrowRight stroke={2} className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
