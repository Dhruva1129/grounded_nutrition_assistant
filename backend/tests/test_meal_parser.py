import json
from pathlib import Path

from app.agent import _rule_based_parse


KB_PATH = Path(__file__).parents[1] / "app" / "nutrition_kb.json"


def test_numbers_only_apply_to_the_food_they_describe():
    """"2 boiled eggs" must not turn the rice serving into 2 grams."""
    kb_items = json.loads(KB_PATH.read_text(encoding="utf-8"))

    result = _rule_based_parse(
        "I had rice with curry beans and 2 boild eggs",
        {},
        kb_items,
    )

    items = {item["kb_entry_name"]: item for item in result["items"]}
    assert items["White Rice (Cooked)"]["calories"] == 195.0
    assert items["Rajma (Kidney Bean Curry)"]["calories"] == 220.0
    assert items["Egg (Boiled)"]["calories"] == 156.0
    assert sum(item["calories"] for item in result["items"]) == 571.0
