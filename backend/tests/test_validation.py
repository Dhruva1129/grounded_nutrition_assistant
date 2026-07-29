import pandas as pd
import pytest

from app import validation


def make_df(rows):
    return pd.DataFrame(rows)


def base_row(**overrides):
    row = {
        "task_id": "T1", "project_id": "P1", "project_name": "Alpha",
        "assignee": "Amy", "status": "Done", "priority": "High",
        "created_date": "2024-01-01", "due_date": "2024-01-10",
        "completed_date": "2024-01-05", "estimated_hours": 5, "actual_hours": 6,
        "tags": "backend",
    }
    row.update(overrides)
    return row


def test_missing_required_column_is_schema_error():
    df = make_df([base_row()]).drop(columns=["status"])
    result = validation.validate_dataframe(df)
    codes = [i.code for i in result.issues]
    assert "MISSING_REQUIRED_COLUMN" in codes
    assert result.clean_rows == []  # cannot proceed row-by-row


def test_missing_required_field_flagged():
    df = make_df([base_row(assignee="")])
    result = validation.validate_dataframe(df)
    assert any(i.code == "MISSING_REQUIRED_FIELD" and i.field == "assignee" for i in result.issues)


def test_duplicate_task_id_detected():
    df = make_df([base_row(task_id="T1"), base_row(task_id="T1", assignee="Bob")])
    result = validation.validate_dataframe(df)
    codes = [i.code for i in result.issues]
    assert "DUPLICATE_TASK_ID" in codes
    assert 3 in result.duplicate_row_numbers  # second row


def test_exact_duplicate_row_detected():
    df = make_df([base_row(task_id="T1"), base_row(task_id="T2")])
    df.iloc[1] = df.iloc[0]
    df.loc[1, "task_id"] = "T1"  # keep unique key logic separate; force full-row dup
    result = validation.validate_dataframe(df)
    assert any(i.code == "DUPLICATE_FULL_ROW" for i in result.issues)


def test_invalid_status_flagged():
    df = make_df([base_row(status="Blocked")])
    result = validation.validate_dataframe(df)
    assert any(i.code == "INVALID_STATUS" for i in result.issues)


def test_completed_before_created_flagged():
    df = make_df([base_row(created_date="2024-02-01", completed_date="2024-01-01")])
    result = validation.validate_dataframe(df)
    assert any(i.code == "COMPLETED_BEFORE_CREATED" for i in result.issues)


def test_done_status_without_completed_date_flagged():
    df = make_df([base_row(status="Done", completed_date="")])
    result = validation.validate_dataframe(df)
    assert any(i.code == "DONE_WITHOUT_COMPLETED_DATE" for i in result.issues)


def test_actual_far_exceeds_estimate_flagged_as_suspicious():
    df = make_df([base_row(estimated_hours=2, actual_hours=50)])
    result = validation.validate_dataframe(df)
    issue = next(i for i in result.issues if i.code == "ACTUAL_FAR_EXCEEDS_ESTIMATE")
    assert issue.category == "suspicious"


def test_negative_hours_flagged():
    df = make_df([base_row(actual_hours=-3)])
    result = validation.validate_dataframe(df)
    assert any(i.code == "NEGATIVE_HOURS" for i in result.issues)


def test_clean_row_has_no_issues():
    df = make_df([base_row()])
    result = validation.validate_dataframe(df)
    assert result.issues == []
    assert len(result.clean_rows) == 1
