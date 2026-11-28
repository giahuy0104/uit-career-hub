package vn.edu.uit.careerhub.ml;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * LightGBM binary model exported by ml/export_model.py: each tree is a node array, split "x <= threshold"
 * goes left. Explanations use the Saabas method: along the path, each split's feature receives the change
 * in the node's expected value.
 */
public final class GbdtModel implements MlModel {
    private final List<String> features;
    private final List<Tree> trees;
    private final JsonNode meta;

    private GbdtModel(List<String> features, List<Tree> trees, JsonNode meta) {
        this.features = List.copyOf(features);
        this.trees = List.copyOf(trees);
        this.meta = meta;
    }

    static GbdtModel from(JsonNode json) {
        List<Tree> trees = new ArrayList<>();
        json.path("trees").forEach(tree -> trees.add(Tree.from(tree)));
        return new GbdtModel(LogisticModel.strings(json.path("features")), trees, json);
    }

    @Override public List<String> features() { return features; }

    @Override public JsonNode meta() { return meta; }

    @Override
    public double probability(double[] x) {
        double sum = 0;
        for (Tree tree : trees) sum += tree.value[tree.leaf(x)];
        return MlModel.sigmoid(sum);
    }

    @Override
    public double[] contributions(double[] x) {
        double[] result = new double[features.size()];
        for (Tree tree : trees) {
            int node = 0;
            while (!tree.leaf[node]) {
                int next = tree.next(node, x);
                result[tree.feature[node]] += tree.value[next] - tree.value[node];
                node = next;
            }
        }
        return result;
    }

    private record Tree(boolean[] leaf, int[] feature, double[] threshold, boolean[] defaultLeft, double[] value,
            int[] left, int[] right) {
        static Tree from(JsonNode nodes) {
            int size = nodes.size();
            Tree tree = new Tree(new boolean[size], new int[size], new double[size], new boolean[size], new double[size],
                    new int[size], new int[size]);
            for (int i = 0; i < size; i++) {
                JsonNode node = nodes.get(i);
                tree.leaf[i] = node.path("leaf").asBoolean();
                tree.value[i] = node.path("value").asDouble();
                if (!tree.leaf[i]) {
                    tree.feature[i] = node.path("feature").asInt();
                    tree.threshold[i] = node.path("threshold").asDouble();
                    tree.defaultLeft[i] = node.path("defaultLeft").asBoolean();
                    tree.left[i] = node.path("left").asInt();
                    tree.right[i] = node.path("right").asInt();
                }
            }
            return tree;
        }

        int next(int node, double[] x) {
            double value = x[feature[node]];
            if (Double.isNaN(value)) return defaultLeft[node] ? left[node] : right[node];
            return value <= threshold[node] ? left[node] : right[node];
        }

        int leaf(double[] x) {
            int node = 0;
            while (!leaf[node]) node = next(node, x);
            return node;
        }
    }
}
