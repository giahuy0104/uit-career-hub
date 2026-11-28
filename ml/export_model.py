"""Turns trained models into small JSON files the Java backend evaluates without Python."""
import json


def gbdt_json(booster, features, meta):
    dump = booster.dump_model()
    names = dump["feature_names"]
    assert names == features, (names, features)
    trees = []
    for info in dump["tree_info"]:
        nodes = []

        def walk(node):
            index = len(nodes)
            nodes.append(None)
            if "leaf_value" in node:
                nodes[index] = {"leaf": True, "value": node["leaf_value"]}
            else:
                assert node["decision_type"] == "<=", node["decision_type"]
                left = walk(node["left_child"])
                right = walk(node["right_child"])
                nodes[index] = {"leaf": False, "feature": node["split_feature"], "threshold": node["threshold"],
                                "defaultLeft": node["default_left"], "value": node["internal_value"],
                                "left": left, "right": right}
            return index

        walk(info["tree_structure"])
        trees.append(nodes)
    return {"type": "gbdt", "objective": "binary", "features": features, "trees": trees, **meta}


def logistic_json(scaler, model, features, meta):
    return {"type": "logistic", "features": features, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
            "coef": model.coef_[0].tolist(), "intercept": float(model.intercept_[0]), **meta}


def write(path, data):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, separators=(",", ":"))
