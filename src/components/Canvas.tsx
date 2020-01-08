import React, { useRef, useEffect, useState } from "react";
import { defineBlock } from "./define-block";
import { useField } from "./Page";
import styled from "styled-components";
import { useDrag } from "react-use-gesture";

function on(element, event, callback) {
  const events = event.split(" ");

  for (let eve of events) {
    element.addEventListener(eve, callback);
  }

  return () => {
    for (let eve of events) {
      element.removeEventListener(eve, callback);
    }
  };
}

function emptyRect() {
  return {
    x: 0,
    y: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: 0,
    height: 0
  };
}

type Coord = { x: number; y: number };

function coordRelativeTo(coord: Coord, relativeBase: Coord) {
  return { x: coord.x - relativeBase.x, y: coord.y - relativeBase.y };
}

function coordToPercentage(
  coord: Coord,
  rect: { width: number; height: number }
): Coord {
  return {
    x: coord.x / rect.width,
    y: coord.y / rect.height
  };
}

const dpr = devicePixelRatio;

export default defineBlock({ name: "drawable" })(({ bind }) => {
  /* Canvas ref & context */
  const ref = useRef<HTMLCanvasElement>(null);

  /* Size of the canvas. Used to offset coords */
  const [size, setSize] = useState(emptyRect);
  const [points, setPoints] = useField("canvas", []);

  useEffect(() => {
    setSize(ref.current.getBoundingClientRect());
    return on(window, "resize", () => {
      setSize(ref.current.getBoundingClientRect());
    });
  }, []);

  useEffect(() => {
    if (points.length < 2) return;

    let frame;
    let tm;
    let index = points.length - 1;

    const ctx = ref.current.getContext("2d");

    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;

    const doUpdate = () => {
      frame = requestAnimationFrame(async start => {
        const last = points[index];
        ctx.moveTo(last.x * size.width * dpr, last.y * size.height * dpr);
        ctx.beginPath();

        while (index >= 0) {
          const point = points[index];
          const now = performance.now();
          index--;

          /* Only do updates within 10 seconds of anim */
          if (now - start > 10) {
            ctx.stroke();
            ctx.closePath();
            doUpdate();
            return;
          }

          ctx.lineTo(point.x * size.width * dpr, point.y * size.height * dpr);
        }
        ctx.stroke();
        ctx.closePath();
      });
    };

    doUpdate();
    return () => {
      clearTimeout(tm);
      cancelAnimationFrame(frame);
    };
  }, [points, size, ref.current]);

  const dragBindings = useDrag(({ xy, event, first, last }) => {
    const rect = last || ref.current.getBoundingClientRect();
    if (first) {
      event.preventDefault();
    }
    const xyAsCoord = { x: xy[0], y: xy[1] };
    const coord = coordRelativeTo(xyAsCoord, rect);

    const point = coordToPercentage(coord, rect);

    setPoints(points => {
      points.push(point);
    });

    return rect;
  });

  return (
    <CanvasWrapper {...bind} width={16} height={9}>
      <canvas
        width={size.width * dpr}
        height={size.height * dpr}
        {...dragBindings()}
        ref={ref}
      />
    </CanvasWrapper>
  );
});

const CanvasWrapper = styled.div`
  width: 100%;
  max-width: 600px;
  position: relative;
  float: right;

  &::before {
    content: "";
    width: 1px;
    margin-left: -1px;
    float: left;
    height: 0;
    padding-top: ${props => (props.height / props.width) * 100}%;
  }
  &::after {
    /* to clear float */
    content: "";
    display: table;
    clear: both;
  }

  & > canvas {
    background: #212121;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }
`;
