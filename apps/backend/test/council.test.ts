import assert from "node:assert/strict";
import {
  CouncilDirector,
  repeatsReply,
  isAbstention,
  removeEchoedSentences,
} from "../src/agents/CouncilDirector.js";

describe("Council turn selection", () => {
  it("uses one specialist for a narrow question and three for a comparison", () => {
    const director = new CouncilDirector();
    assert.deepEqual(director.select("Проверим гипотезу опытом").speakers, ["einstein"]);
    assert.equal(director.select("Сравните варианты решения").speakers.length, 3);
  });
  it("honours names, including inflected names, without summoning the others", () => {
    const director = new CouncilDirector();
    assert.deepEqual(director.select("Ада и Сократ, предложите своё правило").speakers, [
      "lovelace",
      "socrates",
    ]);
    assert.deepEqual(director.select("Вопрос к Диогену и Макиавелли").speakers, [
      "machiavelli",
      "diogenes",
    ]);
    assert.notEqual(director.select("Сократите план: нужна адаптация").reason, "named");
  });
  it("lets the previously silent members answer without repeating the first group", () => {
    const director = new CouncilDirector();
    const first = director.select("Эйнштейн, Ада и Найтингейл, что предложите?");
    director.finish(first.speakers);
    assert.deepEqual(director.select("Пусть ответят остальные").speakers, [
      "machiavelli",
      "socrates",
      "diogenes",
    ]);
  });
  it("never leaves an ordinary message without a selected speaker and rotates general replies", () => {
    const director = new CouncilDirector();
    const seen = new Set<string>();
    for (let i = 0; i < 18; i++) {
      const plan = director.select("Привет!");
      assert.ok(plan.speakers.length >= 1 && plan.speakers.length <= 3);
      plan.speakers.forEach((id) => seen.add(id));
      director.finish(plan.speakers);
    }
    assert.equal(seen.size, 6);
  });
  it("continues a short follow-up with the last actual speaker and can explicitly invite everyone", () => {
    const director = new CouncilDirector();
    director.finish(["nightingale", "lovelace"]);
    assert.deepEqual(director.select("Поясни подробнее").speakers, ["lovelace"]);
    assert.equal(director.select("Пусть все выскажутся по очереди").speakers.length, 6);
    director.reset();
    assert.equal(director.select("Подробнее").speakers.length, 1);
  });
  it("detects textual echoes but allows a different argument on the same subject", () => {
    const previous = [
      "Сначала учтём число людей и объём воды, затем согласуем временное правило выдачи.",
    ];
    assert.ok(repeatsReply(previous[0], previous));
    assert.equal(
      repeatsReply(
        "У правила должен быть ответственный: пусть представители семей вместе проверяют журнал выдачи.",
        previous,
      ),
      false,
    );
  });
  it("removes copied sentences while preserving a genuinely added step", () => {
    const old = "Проверим число людей в каждой семье перед распределением общего запаса.";
    const added = "Но правило нужно пересмотреть, если запас не пополнится завтра.";
    assert.equal(removeEchoedSentences(`${old} ${added}`, [old]), added);
    assert.ok(isAbstention("[ВОЗДЕРЖУССЬ]"));
    assert.ok(isAbstention("Воздержусь."));
    assert.equal(isAbstention("Воздержусь от обвинений, пока не проверим часы."), false);
  });
});
