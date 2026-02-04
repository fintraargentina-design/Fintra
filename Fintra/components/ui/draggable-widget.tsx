"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, GripHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DraggableWidgetProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  width?: number | string;
  height?: number | string;
}

// Global counter for z-index management
let globalZIndex = 50;

export default function DraggableWidget({
  title,
  isOpen,
  onClose,
  children,
  initialPosition = { x: 100, y: 100 },
  width = 800,
  height = 600,
}: DraggableWidgetProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [zIndex, setZIndex] = useState(globalZIndex);
  
  // Ref for the widget to check bounds if needed
  const widgetRef = useRef<HTMLDivElement>(null);

  const bringToFront = () => {
    globalZIndex += 1;
    setZIndex(globalZIndex);
  };

  useEffect(() => {
    setMounted(true);
    bringToFront();
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      ref={widgetRef}
      onMouseDownCapture={bringToFront}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        zIndex: zIndex,
      }}
      className="flex flex-col shadow-2xl rounded-lg overflow-hidden border border-[#333] bg-[#0e0e0e]"
    >
      {/* Header Bar - Draggable Area */}
      <div
        onMouseDown={handleMouseDown}
        className="h-[32px] border-b border-[#222] bg-[#0e0e0e] flex items-center justify-center px-2 cursor-move select-none shrink-0 relative"
      >
        <div className="flex items-center gap-2 absolute left-2">
          <GripHorizontal className="w-3.5 h-3.5 text-[#444] hover:text-[#666] transition-colors" />
        </div>

        <span className="text-[11px] font-medium text-[#888] tracking-wide uppercase">{title}</span>

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-[#222] text-[#888] hover:text-white transition-colors absolute right-2"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>,
    document.body
  );
}
