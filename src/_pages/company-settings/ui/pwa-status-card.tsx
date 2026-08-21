"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export function PwaStatusCard() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof window !== "undefined" ? navigator.onLine : true;
  });

  const [hasDraftInCache, setHasDraftInCache] = useState<boolean>(() => {
    return typeof window !== "undefined"
      ? Boolean(localStorage.getItem("mjt_collection_draft"))
      : false;
  });

  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const handleSyncCheck = () => {
    setIsChecking(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        setIsOnline(navigator.onLine);
        const draftData = localStorage.getItem("mjt_collection_draft");
        setHasDraftInCache(Boolean(draftData));
      }
      setIsChecking(false);
    }, 600);
  };

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--color-text)]">
            Status da PWA & Conectividade
          </h2>
          <Badge status={isOnline ? "collected" : "draft"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          O aplicativo opera online-first com continuidade offline em campo.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 text-xs text-[var(--color-[var(--color-text)])]">
        <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
          <span className="text-[var(--color-muted)]">Estado da Conexão:</span>
          <span className="font-semibold">{isOnline ? "Conectado à Internet" : "Sem Conexão"}</span>
        </div>
        <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
          <span className="text-[var(--color-muted)]">Cache Local de Rascunho:</span>
          <span className="font-semibold">{hasDraftInCache ? "Possui Rascunho Em Cache" : "Nenhum Rascunho Pendente"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">Service Worker:</span>
          <span className="font-semibold">Ativo</span>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={handleSyncCheck}
          isLoading={isChecking}
        >
          🔄 Testar Conexão / Sincronizar
        </Button>
      </CardFooter>
    </Card>
  );
}
