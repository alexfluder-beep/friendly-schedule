# App art made with Gemini

`prompts.json` lists 30 avatar pictures (Georgian places, food and travel things) and one picture per badge (75), in the app's warm Paper colours, without text.
`make_art.py` sends each prompt to Gemini once and saves `out/avatars/<id>.png` and `out/badges/<id>.png`. It skips pictures that already exist, so it can be stopped and restarted.

Run it where the Gemini key already is (the bot server):

    cd friendly-schedule
    set -a; . /path/to/bot/.env; set +a        # loads GEMINI_API_KEY without printing it
    python3 tools/art/make_art.py --limit 3     # test: three pictures, look at them
    python3 tools/art/make_art.py               # the rest (about 105 pictures, a few US cents each)

Then commit only `tools/art/out/` to a new branch `art-raw` and push it. Claude then checks the pictures, makes them small (WebP), and adds them to the avatar library and badges.
