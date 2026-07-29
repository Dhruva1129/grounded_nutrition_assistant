import types
from datetime import date

from app import analytics


def R(**kw):
    base = dict(
        id="id", task_id=None, project_id=None, assignee=None, status=None,
        priority=None, created_date=None, due_date=None, completed_date=None,
        estimated_hours=None, actual_hours=None,
    )
    base.update(kw)
    return types.SimpleNamespace(**base)


def sample_records():
    return [
        R(id="1", task_id="T1", project_id="P1", assignee="Amy", status="Done",
          created_date=date(2024, 1, 1), completed_date=date(2024, 1, 5),
          due_date=date(2024, 1, 10), estimated_hours=5, actual_hours=6),
        R(id="2", task_id="T2", project_id="P1", assignee="Bob", status="Done",
          created_date=date(2024, 1, 3), completed_date=date(2024, 1, 20),
          due_date=date(2024, 1, 10), estimated_hours=5, actual_hours=25),
        R(id="3", task_id="T3", project_id="P2", assignee="Amy", status="In Progress",
          created_date=date(2024, 1, 15), due_date=date(2024, 1, 10)),
    ]


def test_cycle_time_only_counts_done_with_both_dates():
    res = analytics.run_analysis("cycle_time", sample_records(), {})
    assert res["metrics"]["n_completed_tasks"] == 2
    assert res["metrics"]["overall"]["min"] == 4
    assert res["metrics"]["overall"]["max"] == 17


def test_cycle_time_stats_include_precomputed_spread():
    res = analytics.run_analysis("cycle_time", sample_records(), {})
    overall = res["metrics"]["overall"]
    assert overall["p90_minus_median"] == round(overall["p90"] - overall["median"], 2)


def test_overdue_rate_counts_open_task_past_due_as_overdue():
    res = analytics.run_analysis("overdue_rate", sample_records(), {"as_of_date": "2024-02-01"})
    assert res["metrics"]["n_eligible_tasks_with_due_date"] == 3
    # T2 finished late (completed 2024-01-20 > due 2024-01-10); T3 is open and past due
    assert res["metrics"]["n_overdue"] == 2


def test_estimation_accuracy_variance_signs():
    res = analytics.run_analysis("estimation_accuracy", sample_records(), {})
    assert res["metrics"]["n_underestimated"] == 2  # both completed tasks ran over
    assert res["metrics"]["n_overestimated"] == 0


def test_workload_distribution_counts_per_assignee():
    res = analytics.run_analysis("workload_distribution", sample_records(), {})
    assert res["metrics"]["task_count_by_assignee"]["Amy"] == 2
    assert res["metrics"]["task_count_by_assignee"]["Bob"] == 1


def test_evidence_record_ids_are_traceable():
    res = analytics.run_analysis("cycle_time", sample_records(), {})
    assert set(res["evidence_record_ids"]) == {"1", "2"}


def test_unknown_analysis_type_raises():
    try:
        analytics.run_analysis("not_a_real_analysis", sample_records(), {})
        assert False, "expected ValueError"
    except ValueError:
        pass
