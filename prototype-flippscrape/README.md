# PROTOTYPE — throwaway

Checks whether https://github.com/Kiizon/flippscrape still scrapes Flipp flyers.
Uses the project-root venv (`../.venv`, has requests + pandas).

    source ../.venv/bin/activate
    python run_prototype.py M5V3L9      # or omit the code to be prompted

Writes `flyer_items_<POSTAL_CODE>.csv` here. The upstream repo is cloned unchanged in `flippscrape/`.
