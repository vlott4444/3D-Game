
export default function InteractionHint() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 45,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(20, 28, 44, 0.88)",
        color: "white",
        padding: "10px 18px",
        borderRadius: 12,
        fontFamily: "Arial",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <strong>E</strong> — Поговорить
    </div>
  );
}
